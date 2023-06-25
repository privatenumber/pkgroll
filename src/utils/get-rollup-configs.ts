import fs from 'fs';
import path from 'path';
import type { OutputOptions } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import type { PackageJson } from 'type-fest';
import type { TsConfigJsonResolved } from 'get-tsconfig';
import type { ExportEntry, AliasMap } from '../types';
import { isFormatEsm, createRequire } from './rollup-plugins/create-require';
import { esbuildTransform, esbuildMinify } from './rollup-plugins/esbuild';
import { externalizeNodeBuiltins } from './rollup-plugins/externalize-node-builtins';
import { patchBinary } from './rollup-plugins/patch-binary';
import { resolveTypescriptMjsCts } from './rollup-plugins/resolve-typescript-mjs-cjs';
import { getExternalDependencies } from './parse-package-json/get-external-dependencies';

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

const getConfig = {
	async type(
		options: Options,
	) {
		const dts = await import('rollup-plugin-dts');

		return {
			input: [] as string[],
			preserveEntrySignatures: 'strict' as const,
			plugins: [
				externalizeNodeBuiltins(options),
				resolveTypescriptMjsCts(),
				dts.default({
					respectExternal: true,
				}),
			],
			output: [] as OutputOptions[] & Record<string, any>,
			external: [] as (string | RegExp)[],
		};
	},

	app(
		options: Options,
		aliases: AliasMap,
		env: EnvObject,
		executablePaths: string[],
		tsconfigRaw: TsConfigJsonResolved
	) {
		const esbuildConfig = {
			target: options.target,
			tsconfigRaw: tsconfigRaw as string,
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
			output: [] as OutputOptions[] & Record<string, any>,
			external: [] as (string | RegExp)[],
		};
	},
};

type GetConfig = typeof getConfig;

type RollupConfigs = {
	[T in keyof GetConfig]?: Awaited<ReturnType<GetConfig[T]>>;
};

export async function getRollupConfigs(
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
	tsconfigRaw: TsConfigJsonResolved
) {
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
				tsconfigRaw
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
				entryFileNames: chunk => (
					fs.realpathSync.native(stripQuery(chunk.facadeModuleId!))
						.slice(sourceDirectoryPath.length, -srcExtension.length)
					+ distExtension
				),
			};

			outputs.push(outputOptions);
			outputs[key] = outputOptions;
		}
	}

	return configs;
}
