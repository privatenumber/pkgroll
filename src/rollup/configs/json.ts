import type { Plugin, RollupOptions } from 'rollup';
import type { EntryPointValid } from '../../utils/get-build-entry-points/types.ts';
import { slash } from '../../utils/normalize-path.ts';
import { type OutputWithOptions, entrySymbol } from '../types.ts';

const name = 'json-assets';

const jsonAssets = (
	entryPoints: EntryPointValid[],
	minify: boolean,
): Plugin => {
	const sourcePaths = new Set(entryPoints.map(entry => slash(entry.sourcePath)));

	return {
		name,

		transform(code, id) {
			if (!sourcePaths.has(slash(id))) {
				return;
			}

			let parsed: unknown;
			try {
				parsed = JSON.parse(code);
			} catch (error) {
				this.error(`Failed to parse JSON: ${(error as Error).message}`);
			}

			// Rollup requires entries to be JavaScript modules. The placeholder
			// chunk is replaced with the JSON asset in generateBundle.
			return {
				code: 'export default 0;',
				meta: {
					[name]: {
						source: minify ? JSON.stringify(parsed) : code,
					},
				},
			};
		},

		generateBundle(_options, bundle) {
			for (const [fileName, output] of Object.entries(bundle)) {
				if (
					output.type !== 'chunk'
					|| !output.isEntry
					|| !output.facadeModuleId
					|| !sourcePaths.has(slash(output.facadeModuleId))
				) {
					continue;
				}

				const sourcePath = output.facadeModuleId;
				delete bundle[fileName];
				this.emitFile({
					type: 'asset',
					fileName,
					source: this.getModuleInfo(sourcePath)!.meta[name].source,
					originalFileName: sourcePath,
				});
			}
		},
	};
};

export const getJsonConfig = (
	entryPoints: EntryPointValid[],
	sharedDistDirectory: string,
	minify: boolean,
) => {
	const input: Record<string, string> = {};
	for (const entry of entryPoints) {
		input[entry.inputNames![0]] = entry.sourcePath;
	}

	const firstEntry = entryPoints[0];

	const output: OutputWithOptions = {
		dir: sharedDistDirectory,
		format: 'esm',
		entryFileNames: `[name]${firstEntry.distExtension}`,
		// One output covers every JSON entry, so collect all input names for
		// filterUnnecessaryOutputs.
		[entrySymbol]: {
			inputNames: entryPoints.flatMap(entry => entry.inputNames!),
		},
	};

	return {
		input,
		plugins: [jsonAssets(entryPoints, minify)],
		output: [output],
	} satisfies RollupOptions;
};
