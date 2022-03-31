import fs from 'fs';
import path from 'path';
import type { Plugin, RenderedChunk, OutputChunk } from 'rollup';
import MagicString from 'magic-string';

export const patchBinary = (
	executablePaths: string[],
): Plugin => ({
	name: 'patch-binary',

	renderChunk(
		code,
		chunk,
		outputOptions,
	) {
		if (!chunk.isEntry || !chunk.facadeModuleId) {
			return;
		}

		const entryFileNames = outputOptions.entryFileNames as (chunk: RenderedChunk) => string;
		const outputPath = `./${path.join(outputOptions.dir!, entryFileNames(chunk))}`;

		if (executablePaths.includes(outputPath)) {
			const transformed = new MagicString(code);
			transformed.prepend('#!/usr/bin/env node\n');

			return {
				code: transformed.toString(),
				map: (
					outputOptions.sourcemap
						? transformed.generateMap({ hires: true })
						: undefined
				),
			};
		}
	},

	async writeBundle(outputOptions, bundle) {
		const entryFileNames = outputOptions.entryFileNames as (chunk: OutputChunk) => string;

		const chmodFiles = Object.values(bundle).map(async (chunk) => {
			const outputChunk = chunk as OutputChunk;

			if (outputChunk.isEntry && outputChunk.facadeModuleId) {
				const outputPath = path.join(outputOptions.dir!, entryFileNames(outputChunk));
				await fs.promises.chmod(outputPath, 0o755);
			}
		});

		await Promise.all(chmodFiles);
	},
});
