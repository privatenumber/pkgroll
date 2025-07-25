import type { Plugin, OutputChunk } from 'rollup';

/**
 * pkgroll merges shared configs, which causes it to build extra entry points
 * that weren't actually requested. We need to filter those out here to:
 * - Avoid generating unnecessary output files
 * - Prevent unexpected files from overwriting the ones we actually want
 */
export const filterUnnecessaryOutputs = (
	inputNames: string[],
): Plugin => ({
	name: 'filter-unnecessary-outputs',
	generateBundle: (_options, bundle) => {
		const allChunkFileNames = Object.keys(bundle).filter(
			fileName => bundle[fileName]!.type === 'chunk',
		);

		const queue: string[] = [];
		for (const fileName of allChunkFileNames) {
			const chunk = bundle[fileName] as OutputChunk;
			if (
				chunk.isEntry
				&& inputNames.includes(chunk.name)
			) {
				queue.push(fileName);
			}
		}

		const chunksToKeep = new Set<string>();
		while (queue.length > 0) {
			const fileName = queue.shift()!;
			const chunk = bundle[fileName];
			if (
				// Can be an externalized import
				!chunk
				|| chunksToKeep.has(fileName)
			) {
				continue;
			}

			chunksToKeep.add(fileName);
			for (const imported of (chunk as OutputChunk).dynamicImports) {
				queue.push(imported);
			}
		}

		for (const fileName of allChunkFileNames) {
			if (!chunksToKeep.has(fileName)) {
				delete bundle[fileName];
			}
		}
	},
});
