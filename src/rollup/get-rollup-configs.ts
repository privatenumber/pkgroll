import type { OutputOptions } from 'rollup';
import type { PackageJson } from 'type-fest';
import type { TsConfigResult } from 'get-tsconfig';
import type { AliasMap, SrcDistPair } from '../types.js';
import type { EntryPointValid } from '../utils/get-entry-points/types.js';
import { getExternalDependencies } from '../utils/parse-package-json/get-external-dependencies.js';
import { normalizePath } from '../utils/normalize-path.js';
import type { Options } from './types.js';
import { getPkgConfig } from './configs/pkg.js';
import { getDtsConfig } from './configs/dts.js';

type RollupConfigs = {
	dts?: Awaited<ReturnType<typeof getDtsConfig>>;
	pkg?: ReturnType<typeof getPkgConfig>;
};

export const getRollupConfigs = async (
	srcdist: SrcDistPair,
	entryPoints: EntryPointValid[],
	flags: Options,
	aliases: AliasMap,
	packageJson: PackageJson,
	tsconfig: TsConfigResult | null,
) => {
	const distDirectory = normalizePath(srcdist.dist, true);
	srcdist.distPrefix = srcdist.dist.slice(distDirectory.length);

	const configs: RollupConfigs = Object.create(null);

	for (const entry of entryPoints) {
		const {
			sourcePath, srcExtension, distExtension, exportEntry,
		} = entry;

		const inputName = (
			srcdist.distPrefix! + sourcePath.slice(srcdist.srcResolved.length, -srcExtension.length)
		);
		entry.inputName = inputName;

		if (exportEntry.format === 'types') {
			let config = configs.dts;

			if (!config) {
				config = await getDtsConfig(flags, tsconfig);
				config.external = getExternalDependencies(packageJson, aliases, true);
				configs.dts = config;
			}

			if (!config.input[inputName]) {
				config.input[inputName] = sourcePath;
			}

			config.output.push({
				dir: distDirectory,
				entryFileNames: `[name]${distExtension}`,
				chunkFileNames: `${srcdist.distPrefix!}[name]-[hash]${distExtension}`,
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
				entryPoints,
				tsconfig,
			);
			config.external = getExternalDependencies(packageJson, aliases);
			configs.pkg = config;
		}

		if (!config.input[inputName]) {
			config.input[inputName] = sourcePath;
		}

		const outputs = config.output;

		// Shouldnt this just be format and extension?
		const key = `${exportEntry.type}-${distExtension}`;
		if (!outputs[key]) {
			const outputOptions: OutputOptions = {
				dir: distDirectory,
				exports: 'auto',
				format: exportEntry.format,
				sourcemap: flags.sourcemap,
				entryFileNames: `[name]${distExtension}`,
				chunkFileNames: `${srcdist.distPrefix!}[name]-[hash]${distExtension}`,
			};

			outputs.push(outputOptions);
			outputs[key] = outputOptions;
		}
	}

	return Object.values(configs);
};
