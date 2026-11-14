import type { PackageJson } from 'type-fest';
import type { TsConfigResult } from 'get-tsconfig';
import type { AliasMap, SrcDistPair, SrcDistPairInput } from '../types.ts';
import type { EntryPointValid } from '../utils/get-build-entry-points/types.ts';
import { normalizePath } from '../utils/normalize-path.ts';
import { isGlobalScriptDts } from '../utils/is-global-script-dts.ts';
import { type Options, type OutputWithOptions, entrySymbol } from './types.ts';
import { getPkgConfig } from './configs/pkg.ts';
import { getDtsConfig } from './configs/dts.ts';
import { getJsonConfig } from './configs/json.ts';

type DtsConfig = Awaited<ReturnType<typeof getDtsConfig>>;
type PkgConfig = ReturnType<typeof getPkgConfig>;
type JsonConfig = ReturnType<typeof getJsonConfig>;

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

/**
 * Group key shared by the entries of one export subpath (or the package's
 * legacy root entries), used to pair a types entry with the JavaScript entry
 * whose exports it describes. CLI inputs and binaries have no group.
 */
const getExportGroupKey = (entry: EntryPointValid): string | undefined => {
	const { exportEntry } = entry;
	if (typeof exportEntry.source === 'string' || exportEntry.type === 'binary') {
		return undefined;
	}
	if (exportEntry.type === 'legacy') {
		return 'legacy';
	}
	return exportEntry.source.path.slice(0, -1).join('/');
};

const isJsSibling = (candidate: EntryPointValid, groupKey: string): boolean => (
	(candidate.exportEntry.format === 'module' || candidate.exportEntry.format === 'commonjs')
	&& getExportGroupKey(candidate) === groupKey
);

const matchesPreferredCondition = (
	candidate: EntryPointValid,
	preferredCondition: string,
): boolean => (
	candidate.exportEntry.type !== 'legacy'
	&& 'conditions' in candidate.exportEntry
	&& candidate.exportEntry.conditions.includes(preferredCondition)
);

/**
 * Find the JavaScript entry from the same export group as a types entry.
 * Prefers the entry whose condition matches the types output format
 * (e.g. `.d.mts` pairs with the `import` entry).
 */
const findSiblingJsEntry = (
	typesEntry: EntryPointValid,
	entryPoints: EntryPointValid[],
): EntryPointValid | undefined => {
	const groupKey = getExportGroupKey(typesEntry);
	if (groupKey === undefined) {
		return undefined;
	}
	let preferredCondition = 'default';
	if (typesEntry.distExtension === '.d.mts') {
		preferredCondition = 'import';
	} else if (typesEntry.distExtension === '.d.cts') {
		preferredCondition = 'require';
	}
	let fallback: EntryPointValid | undefined;
	for (const candidate of entryPoints) {
		if (candidate === typesEntry || !isJsSibling(candidate, groupKey)) {
			continue;
		}
		if (matchesPreferredCondition(candidate, preferredCondition)) {
			return candidate;
		}
		fallback ??= candidate;
	}
	return fallback;
};

/**
 * Input name derived from the requested dist path (relative to the shared
 * dist directory, without the dist extension), so the emitted file lands at
 * the requested output path even when the entry source has a different name.
 */
const getDistInputName = (
	entry: EntryPointValid,
	sharedDistDirectory: string,
	distExtension: string,
): string | undefined => {
	const outputPath = entry.exportEntry.outputPath.replace(/^\.\//, '');
	const distDirectory = sharedDistDirectory.replace(/^\.\//, '');
	if (!outputPath.startsWith(distDirectory)) {
		return undefined;
	}
	return outputPath.slice(distDirectory.length, -distExtension.length);
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

	let dtsConfig: DtsConfig | undefined;

	/**
	 * Separate Rollup builds per output format to prevent format-incompatible
	 * entries from interfering with each other during rendering.
	 *
	 * For example, an ESM entry with top-level await would cause a CJS output
	 * to fail even if the CJS output doesn't include that entry — because Rollup
	 * renders all inputs before filterUnnecessaryOutputs can remove them.
	 */
	const pkgConfigs = new Map<string, PkgConfig>();
	const jsonEntries: EntryPointValid[] = [];

	for (const entry of entryPoints) {
		const {
			sourcePath, srcExtension, distExtension, exportEntry,
		} = entry;
		// Cast srcdist to SrcDistPair since distPrefix was added above
		const srcdist = entry.srcdist as SrcDistPair;

		let inputName = (
			srcdist.distPrefix + sourcePath.slice(srcdist.srcResolved.length, -srcExtension.length)
		);
		entry.inputNames = [inputName];

		if (exportEntry.format === 'json') {
			jsonEntries.push(entry);
			continue;
		}

		if (exportEntry.format === 'types') {
			if (!dtsConfig) {
				dtsConfig = await getDtsConfig(flags, packageJson, tsconfig);
			}

			let dtsSourcePath = sourcePath;
			if (
				srcExtension.startsWith('.d.')
				&& await isGlobalScriptDts(sourcePath)
			) {
				/**
				 * The types entry resolved to an ambient-only `.d.ts` file: a
				 * global script that exports nothing, so bundling it would emit
				 * an empty chunk (`export { }`). Fall back to the JavaScript
				 * entry from the same export group — the types output describes
				 * that entry's exports. The input name is derived from the
				 * requested dist path so the bundle is still emitted at e.g.
				 * `types.d.mts` instead of `index.d.mts`.
				 * https://github.com/privatenumber/pkgroll/issues/95
				 */
				const sibling = findSiblingJsEntry(entry, entryPoints);
				if (sibling) {
					dtsSourcePath = sibling.sourcePath;
					inputName = getDistInputName(entry, sharedDistDirectory, distExtension) ?? inputName;
					entry.inputNames = [inputName];
				}
			}

			if (!dtsConfig.input[inputName]) {
				dtsConfig.input[inputName] = dtsSourcePath;
			}

			const outputs = dtsConfig.output;

			if (outputs[distExtension]) {
				outputs[distExtension][entrySymbol].inputNames!.push(inputName);
			} else {
				const outputOptions: OutputWithOptions = {
					dir: sharedDistDirectory,
					entryFileNames: `[name]${distExtension}`,
					chunkFileNames: `${srcdist.distPrefix}[name]-[hash]${distExtension}`,
					exports: 'auto',
					format: 'esm',
					// .d.ts sourcemaps enabled via --sourcemap flag or declarationMap in tsconfig
					sourcemap: flags.sourcemap || tsconfig?.config.compilerOptions?.declarationMap,
					[entrySymbol]: { inputNames: [inputName] },
				};

				outputs.push(outputOptions);
				outputs[distExtension] = outputOptions;
			}

			continue;
		}

		const key = `${exportEntry.format}-${distExtension}`;
		let config = pkgConfigs.get(key);
		if (!config) {
			// Use the first dist directory for shared assets (chunks, natives)
			const firstDistDirectory = srcdistPairs[0].dist;
			config = getPkgConfig(
				flags,
				packageJson,
				aliases,
				entryPoints,
				tsconfig,
				firstDistDirectory,
			);
			pkgConfigs.set(key, config);
		}

		if (!config.input[inputName]) {
			config.input[inputName] = sourcePath;
		}

		const outputs = config.output;

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
				[entrySymbol]: { inputNames: [inputName] },
			};

			outputs.push(outputOptions);
			outputs[key] = outputOptions;
		}
	}

	const rollupConfigs: (DtsConfig | PkgConfig | JsonConfig)[] = [...pkgConfigs.values()];
	if (jsonEntries.length > 0) {
		rollupConfigs.push(getJsonConfig(jsonEntries, sharedDistDirectory, flags.minify));
	}
	if (dtsConfig) {
		rollupConfigs.push(dtsConfig);
	}
	return rollupConfigs;
};
