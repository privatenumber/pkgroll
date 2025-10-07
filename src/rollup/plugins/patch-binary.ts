import fs from 'node:fs';
import path from 'node:path/posix';
import type { Plugin, SourceMapInput } from 'rollup';
import MagicString from 'magic-string';
import type { EntryPointValid } from '../../utils/get-build-entry-points/types.js';
import { normalizePath } from '../../utils/normalize-path.js';

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

		writeBundle: async (options, bundle) => {
			/**
			 * Not every output contains the binary
			 * (e.g. the binary may only be .mjs, and the current output may be .cjs)
			 */
			const outputFiles = new Set(Object.keys(bundle).map(
				fileName => normalizePath(path.join(options.dir!, fileName)),
			));

			await Promise.all(binaryEntryPoints.map(async ({ exportEntry }) => {
				const { outputPath } = exportEntry;
				const isInBundle = outputFiles.has(outputPath);
				if (isInBundle) {
					await fs.promises.chmod(outputPath, 0o755);
				}
			}));
		},
	};
};
