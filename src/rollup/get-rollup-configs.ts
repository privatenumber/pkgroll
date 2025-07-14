import type { PackageJson } from 'type-fest';
import type { TsConfigResult } from 'get-tsconfig';
import type { AliasMap, SrcDistPair } from '../types.js';
import type { EntryPointValid } from '../utils/get-entry-points/types.js';
import { getExternalDependencies } from '../utils/parse-package-json/get-external-dependencies.js';
import { normalizePath } from '../utils/normalize-path.js';
import { type Options, type OutputWithOptions, entrySymbol } from './types.js';
import { getPkgConfig } from './configs/pkg.js';
import { getDtsConfig } from './configs/dts.js';

type RollupConfigs = {
	dts?: Awaited<ReturnType<typeof getDtsConfig>>;
	pkg?: ReturnType<typeof getPkgConfig>;
};

const getCommonPath = (paths: string[]): string => {
	if (paths.length === 0) { return ''; }

	const splitPaths = paths.map(p => p.split('/'));
	const first = splitPaths[0];
	const minLength = Math.min(...splitPaths.map(p => p.length));

	const commonParts: string[] = [];
	for (let i = 0; i < minLength; i += 1) {
		const segment = first[i];
		if (splitPaths.every(p => p[i] === segment)) {
			commonParts.push(segment);
		} else {
			break;
		}
	}

	// Ensure leading slash
	return commonParts.length === 0 ? '/' : commonParts.join('/') || '/';
};

export const getRollupConfigs = async (
	srcdistPairs: SrcDistPair[],
	entryPoints: EntryPointValid[],
	flags: Options,
	aliases: AliasMap,
	packageJson: PackageJson,
	tsconfig: TsConfigResult | null,
) => {
	const distDirectory = normalizePath(getCommonPath(srcdistPairs.map(({ dist }) => dist)), true);

	for (const srcdistPair of srcdistPairs) {
		srcdistPair.distPrefix = srcdistPair.dist.slice(distDirectory.length);
	}

	const configs: RollupConfigs = Object.create(null);

	for (const entry of entryPoints) {
		const {
			sourcePath, srcdist, srcExtension, distExtension, exportEntry,
		} = entry;

		const inputName = (
			srcdist.distPrefix! + sourcePath.slice(srcdist.srcResolved.length, -srcExtension.length)
		);
		entry.inputNames = [inputName];

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

			const outputs = config.output;

			const key = `${srcdist.distPrefix!}-${distExtension}`;
			if (outputs[key]) {
				outputs[key][entrySymbol].inputNames!.push(inputName);
			} else {
				const outputOptions: OutputWithOptions = {
					dir: distDirectory,
					entryFileNames: `[name]${distExtension}`,
					chunkFileNames: `${srcdist.distPrefix!}[name]-[hash]${distExtension}`,
					exports: 'auto',
					format: 'esm',
					interop: 'auto',
					[entrySymbol]: entry,
				};

				outputs.push(outputOptions);
				outputs[key] = outputOptions;
			}

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

		const key = `${exportEntry.format}-${srcdist.distPrefix}-${distExtension}`;
		if (outputs[key]) {
			outputs[key][entrySymbol].inputNames!.push(inputName);
		} else {
			const outputOptions: OutputWithOptions = {
				dir: distDirectory,
				exports: 'auto',
				format: exportEntry.format,
				sourcemap: flags.sourcemap,
				entryFileNames: `[name]${distExtension}`,
				chunkFileNames: `${srcdist.distPrefix!}[name]-[hash]${distExtension}`,
				[entrySymbol]: entry,
			};

			outputs.push(outputOptions);
			outputs[key] = outputOptions;
		}
	}

	return Object.values(configs);
};
