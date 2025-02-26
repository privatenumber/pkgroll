import fs from 'node:fs';
import path from 'node:path';
import type { OutputOptions } from 'rollup';
import type { PackageJson } from 'type-fest';
import type { TsConfigResult } from 'get-tsconfig';
import type { ExportEntry, AliasMap } from '../types.js';
import { getExternalDependencies } from '../utils/parse-package-json/get-external-dependencies.js';
import type { EnvObject, Options } from './types.js';
import { getPkgConfig } from './configs/pkg.js';
import { getDtsConfig } from './configs/dts.js';

const stripQuery = (url: string) => url.split('?')[0];

type RollupConfigs = {
	dts?: Awaited<ReturnType<typeof getDtsConfig>>;
	pkg?: ReturnType<typeof getPkgConfig>;
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
	tsconfig: TsConfigResult | null,
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
			let config = configs.dts;

			if (!config) {
				config = await getDtsConfig(flags, tsconfig);
				config.external = externalTypeDependencies;
				configs.dts = config;
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

		let config = configs.pkg;
		if (!config) {
			config = getPkgConfig(
				flags,
				aliases,
				env,
				executablePaths,
				tsconfig,
			);
			config.external = externalDependencies;
			configs.pkg = config;
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
					const filePath = path.posix.join(path.dirname(relativePath), chunk.name);
					return filePath + distExtension;
				},
			};

			outputs.push(outputOptions);
			outputs[key] = outputOptions;
		}
	}

	return Object.values(configs);
};
