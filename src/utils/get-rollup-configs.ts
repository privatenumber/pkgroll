import fs from 'fs';
import path from 'path';
import type { OutputOptions, RollupOptions, Plugin } from 'rollup';
// @ts-ignore
import nativePlugin from 'rollup-plugin-natives';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import type { PackageJson } from 'type-fest';
import type { ExportEntry, AliasMap } from '../types.js';
import { isFormatEsm, createRequire } from './rollup-plugins/create-require.js';
import { esbuildTransform, esbuildMinify } from './rollup-plugins/esbuild.js';
import { externalizeNodeBuiltins } from './rollup-plugins/externalize-node-builtins.js';
import { patchBinary } from './rollup-plugins/patch-binary.js';
import { resolveTypescriptMjsCts } from './rollup-plugins/resolve-typescript-mjs-cjs.js';
import { stripHashbang } from './rollup-plugins/strip-hashbang.js';
import { getExternalDependencies } from './parse-package-json/get-external-dependencies.js';

type Options = {
	minify: boolean;
	target: string[];
	exportCondition: string[];
	env: {
		key: string;
		value: string;
	}[];
	sourcemap?: true | 'inline';
};

type EnvObject = {
	[key: string]: string;
};

const stripQuery = (url: string) => url.split('?')[0];

type Output = OutputOptions[] & Record<string, OutputOptions>;

const getConfig = {
	type: async (
		options: Options,
	) => {
		const dts = await import('rollup-plugin-dts');

		return {
			input: [] as string[],
			preserveEntrySignatures: 'strict' as const,
			plugins: [
				externalizeNodeBuiltins(options),
				resolveTypescriptMjsCts(),
				dts.default({
					respectExternal: true,

					/**
					 * https://github.com/privatenumber/pkgroll/pull/54
					 *
					 * I think this is necessary because TypeScript's composite requires
					 * that all files are passed in via `include`. However, it seems that
					 * rollup-plugin-dts doesn't read or relay the `include` option in tsconfig.
					 *
					 * For now, simply disabling composite does the trick since it doesn't seem
					 * necessary for dts bundling.
					 *
					 * One concern here is that this overwrites the compilerOptions. According to
					 * the rollup-plugin-dts docs, it reads from baseUrl and paths.
					 */
					compilerOptions: { composite: false },
				}) as Plugin,
			],
			output: [] as unknown as Output,
			external: [] as (string | RegExp)[],
		} satisfies RollupOptions;
	},

	app: (
		options: Options,
		aliases: AliasMap,
		env: EnvObject,
		executablePaths: string[],
	) => {
		const esbuildConfig = {
			target: options.target,
		};

		return {
			input: [] as string[],
			preserveEntrySignatures: 'strict' as const,
			plugins: [
				externalizeNodeBuiltins(options),
				resolveTypescriptMjsCts(),
				alias({
					entries: aliases,
				}),
				nodeResolve({
					extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
					exportConditions: options.exportCondition,
				}),
				nativePlugin({
					copyTo: 'dist/nativeLibs',
					destDir: './nativeLibs',
					targetEsm: true,
				}),
				...(
					Object.keys(env).length > 0
						? [replace({
							preventAssignment: true,

							/**
							 * Seems this currently doesn't work:
							 * https://github.com/rollup/plugins/pull/1084#discussion_r861447543
							 */
							objectGuards: true,
							values: env,
						})]
						: []
				),
				stripHashbang(),
				commonjs(),
				json(),
				esbuildTransform(esbuildConfig),
				createRequire(),
				...(
					options.minify
						? [esbuildMinify(esbuildConfig)]
						: []
				),
				patchBinary(executablePaths),
			],
			output: [] as unknown as Output,
			external: [] as (string | RegExp)[],
		} satisfies RollupOptions;
	},
};

type GetConfig = typeof getConfig;

type RollupConfigs = {
	[T in keyof GetConfig]?: Awaited<ReturnType<GetConfig[T]>>;
};

export const getRollupConfigs = async (
	sourceDirectoryPath: string,
	distributionDirectoryPath: string,
	inputs: {
		input: string;
		srcExtension: string;
		distExtension: string;
		exportEntry: ExportEntry;
	}[],
	flags: Options,
	aliases: AliasMap,
	packageJson: PackageJson,
) => {
	const executablePaths = inputs
		.filter(({ exportEntry }) => exportEntry.isExecutable)
		.map(({ exportEntry }) => exportEntry.outputPath);

	const configs: RollupConfigs = Object.create(null);

	const env: EnvObject = Object.fromEntries(
		flags.env.map(({ key, value }) => [`process.env.${key}`, JSON.stringify(value)]),
	);

	const externalDependencies = getExternalDependencies(packageJson, aliases);
	const externalTypeDependencies = getExternalDependencies(packageJson, aliases, true);

	for (const {
		input, srcExtension, distExtension, exportEntry,
	} of inputs) {
		if (exportEntry.type === 'types') {
			let config = configs.type;

			if (!config) {
				config = await getConfig.type(flags);
				config.external = externalTypeDependencies;
				configs.type = config;
			}

			if (!config.input.includes(input)) {
				config.input.push(input);
			}

			config.output.push({
				dir: distributionDirectoryPath,

				/**
				 * Preserve source path in dist path
				 * realpath used for few reasons:
				 * - dts plugin resolves paths to be absolute anyway, but doesn't resolve symlinks
				 * - input may be an absolute symlink path
				 * - test tmpdir is a symlink: /var/ -> /private/var/
				*/
				entryFileNames: chunk => (
					fs.realpathSync.native(stripQuery(chunk.facadeModuleId!))
						.slice(sourceDirectoryPath.length, -srcExtension.length)
					+ distExtension
				),

				exports: 'auto',
				format: 'esm',
			});

			continue;
		}

		let config = configs.app;
		if (!config) {
			config = getConfig.app(
				flags,
				aliases,
				env,
				executablePaths,
			);
			config.external = externalDependencies;
			configs.app = config;
		}

		if (!config.input.includes(input)) {
			config.input.push(input);
		}

		const outputs = config.output;
		const extension = path.extname(exportEntry.outputPath);
		const key = `${exportEntry.type}-${extension}`;
		if (!outputs[key]) {
			const outputOptions: OutputOptions = {
				dir: distributionDirectoryPath,
				exports: 'auto',
				format: exportEntry.type,
				chunkFileNames: `[name]-[hash]${extension}`,
				sourcemap: flags.sourcemap,
				plugins: [
					isFormatEsm(exportEntry.type === 'module'),
				],

				/**
				 * Preserve source path in dist path
				 * realpath used for few reasons:
				 * - dts plugin resolves paths to be absolute anyway, but doesn't resolve symlinks
				 * - input may be an absolute symlink path
				 * - test tmpdir is a symlink: /var/ -> /private/var/
				 */
				entryFileNames: (chunk) => {
					const realPath = fs.realpathSync.native(stripQuery(chunk.facadeModuleId!));
					const relativePath = realPath.slice(sourceDirectoryPath.length);
					const [filePath] = relativePath.split('.');
					return filePath + distExtension;
				},
			};

			outputs.push(outputOptions);
			outputs[key] = outputOptions;
		}
	}

	return configs satisfies Record<string, RollupOptions>;
};
