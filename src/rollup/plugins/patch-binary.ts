import fs from 'node:fs';
import path from 'node:path/posix';
import type { Plugin, SourceMapInput } from 'rollup';
import MagicString from 'magic-string';
import type { BinaryOutput, EntryPointValid } from '../../utils/get-build-entry-points/types.ts';
import { normalizePath } from '../../utils/normalize-path.ts';

const defaultHashbang = '#!/usr/bin/env node';

export const patchBinary = (
	entryPoints: EntryPointValid[],
): Plugin => {
	const binaryEntryPoints = entryPoints.filter(
		(entry): entry is EntryPointValid<BinaryOutput> => entry.exportEntry.type === 'binary',
	);
	if (binaryEntryPoints.length === 0) {
		return {
			name: 'patch-binary',
		};
	}

	// inputName → hashbang from that bin's entry source (or default)
	let hashbangByInputName: Map<string, string>;

	return {
		name: 'patch-binary',

		options: () => {
			// At this point, all inputNames will be set
			hashbangByInputName = new Map(
				binaryEntryPoints.flatMap((entry) => {
					const hashbang = entry.exportEntry.hashbang ?? defaultHashbang;
					return entry.inputNames!.map(name => [name, hashbang] as const);
				}),
			);
		},

		renderChunk: (code, chunk, outputOptions) => {
			if (!chunk.isEntry) {
				return;
			}

			const hashbang = hashbangByInputName.get(chunk.name);
			if (!hashbang) {
				return;
			}

			const transformed = new MagicString(code);
			transformed.prepend(`${hashbang}\n`);

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
				// Use the emitted spelling of the path (e.g. "./dist/./cli.mjs" -> "./dist/cli.mjs")
				const outputPath = normalizePath(path.normalize(exportEntry.outputPath));
				if (outputFiles.has(outputPath)) {
					await fs.promises.chmod(outputPath, 0o755);
				}
			}));
		},
	};
};
