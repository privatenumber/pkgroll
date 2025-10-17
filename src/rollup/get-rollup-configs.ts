import type { PackageJson } from 'type-fest';
import type { TsConfigResult } from 'get-tsconfig';
import type { AliasMap, SrcDistPair, SrcDistPairInput } from '../types.js';
import type { EntryPointValid } from '../utils/get-build-entry-points/types.js';
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
	srcdistPairsInput: SrcDistPairInput[],
	entryPoints: EntryPointValid[],
	flags: Options,
	aliases: AliasMap,
	packageJson: PackageJson,
	tsconfig: TsConfigResult | null,
) => {
	/**
	 * Calculate shared dist directory for Rollup's `dir` option.
	 *
	 * When multiple src:dist pairs exist (e.g., src:dist-a, lib:dist-b):
	 * - sharedDistDirectory = common path (e.g., "" for root, or "dist/" if both under dist/)
	 * - distPrefix = relative path from shared to specific dist (e.g., "dist-a/", "dist-b/")
	 *
	 * Rollup output config uses:
	 * - `dir: sharedDistDirectory` - where Rollup writes files
	 * - `entryFileNames: [name].js` - includes distPrefix in [name]
	 * - `chunkFileNames: ${distPrefix}[name]-[hash].js` - shared chunks go to first dist
	 *
	 * Example: dist-a/index.js and dist-b/utils.js both output to root with prefixes.
	 */
	const sharedDistDirectory = normalizePath(
		getCommonPath(srcdistPairsInput.map(({ dist }) => dist)),
		true,
	);

	// Add distPrefix to each pair for Rollup path patterns
	// This mutates the input objects and changes their type from Input → configured
	for (const srcdistPair of srcdistPairsInput) {
		(srcdistPair as SrcDistPair).distPrefix = srcdistPair.dist.slice(sharedDistDirectory.length);
	}
	const srcdistPairs = srcdistPairsInput as SrcDistPair[];

	const configs: RollupConfigs = Object.create(null);

	for (const entry of entryPoints) {
		const {
			sourcePath, srcExtension, distExtension, exportEntry,
		} = entry;
		// Cast srcdist to SrcDistPair since distPrefix was added above
		const srcdist = entry.srcdist as SrcDistPair;

		const inputName = (
			srcdist.distPrefix + sourcePath.slice(srcdist.srcResolved.length, -srcExtension.length)
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

			if (outputs[distExtension]) {
				outputs[distExtension][entrySymbol].inputNames!.push(inputName);
			} else {
				const outputOptions: OutputWithOptions = {
					dir: sharedDistDirectory,
					entryFileNames: `[name]${distExtension}`,
					chunkFileNames: `${srcdist.distPrefix}[name]-[hash]${distExtension}`,
					exports: 'auto',
					format: 'esm',
					[entrySymbol]: entry,
				};

				outputs.push(outputOptions);
				outputs[distExtension] = outputOptions;
			}

			continue;
		}

		let config = configs.pkg;
		if (!config) {
			// Use the first dist directory for shared assets (chunks, natives)
			const firstDistDirectory = srcdistPairs[0].dist;
			config = getPkgConfig(
				flags,
				aliases,
				entryPoints,
				tsconfig,
				firstDistDirectory,
			);
			config.external = getExternalDependencies(packageJson, aliases);
			configs.pkg = config;
		}

		if (!config.input[inputName]) {
			config.input[inputName] = sourcePath;
		}

		const outputs = config.output;

		const key = `${exportEntry.format}-${distExtension}`;
		if (outputs[key]) {
			outputs[key][entrySymbol].inputNames!.push(inputName);
		} else {
			const outputOptions: OutputWithOptions = {
				dir: sharedDistDirectory,
				exports: 'auto',
				format: exportEntry.format,
				sourcemap: flags.sourcemap,
				entryFileNames: `[name]${distExtension}`,

				/**
				 * When there's multiple dist directories via `--srcdist`, the entryFileNames
				 * includes the specific subdirectories they belong to, but the shared
				 * chunks don't and will be placed in the first dist directory.
				 */
				chunkFileNames: `${srcdist.distPrefix}[name]-[hash]${distExtension}`,
				[entrySymbol]: entry,
			};

			outputs.push(outputOptions);
			outputs[key] = outputOptions;
		}
	}

	return Object.values(configs);
};
