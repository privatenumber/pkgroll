import fs from 'node:fs';
import type { Plugin, SourceMapInput } from 'rollup';
import MagicString from 'magic-string';
import type { EntryPointValid } from '../../utils/get-entry-points/types.js';

export const patchBinary = (
	entryPoints: EntryPointValid[],
): Plugin => {
	const binaryEntryPoints = entryPoints.filter(entry => entry.exportEntry.type === 'binary');
	if (binaryEntryPoints.length === 0) {
		return {
			name: 'patch-binary',
		};
	}

	let binaryFiles: Set<string>;

	return {
		name: 'patch-binary',

		options: () => {
			// At this point, all inputNames will be set
			binaryFiles = new Set(binaryEntryPoints.flatMap(entry => entry.inputNames!));
		},

		renderChunk: (code, chunk, outputOptions) => {
			if (
				!chunk.isEntry
				|| !chunk.facadeModuleId
				|| !binaryFiles.has(chunk.name)
			) {
				return;
			}

			const transformed = new MagicString(code);
			transformed.prepend('#!/usr/bin/env node\n');

			return {
				code: transformed.toString(),
				map: (
					outputOptions.sourcemap
						? transformed.generateMap({ hires: true }) as SourceMapInput
						: undefined
				),
			};
		},

		writeBundle: async () => {
			await Promise.all(binaryEntryPoints.map(async ({ exportEntry }) => {
				const { outputPath } = exportEntry;
				await fs.promises.chmod(outputPath, 0o755);
			}));
		},
	};
};
