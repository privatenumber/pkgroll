import fs from 'node:fs/promises';
import type { Plugin, RollupOptions } from 'rollup';
import type { EntryPointValid } from '../../utils/get-build-entry-points/types.ts';
import { formatPath } from '../../utils/log.ts';
import { slash } from '../../utils/normalize-path.ts';
import { type OutputWithOptions, entrySymbol } from '../types.ts';

const jsonAssets = (
	entryPoints: EntryPointValid[],
	minify: boolean,
): Plugin => {
	const sourcePaths = new Set(entryPoints.map(entry => slash(entry.sourcePath)));

	return {
		name: 'json-assets',

		load(id) {
			if (sourcePaths.has(slash(id))) {
				// Rollup requires entries to be JavaScript modules. The dummy
				// chunk is replaced with the original JSON in generateBundle.
				return 'export default 0;';
			}
		},

		async generateBundle(_options, bundle) {
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
				const source = await fs.readFile(sourcePath);
				const text = source.toString('utf8').replace(/^\uFEFF/, '');

				let parsed: unknown;
				try {
					parsed = JSON.parse(text);
				} catch (error) {
					this.error(`Failed to parse JSON in "${formatPath(sourcePath)}": ${(error as Error).message}`);
				}

				delete bundle[fileName];
				this.emitFile({
					type: 'asset',
					fileName,
					source: minify ? JSON.stringify(parsed) : source,
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
