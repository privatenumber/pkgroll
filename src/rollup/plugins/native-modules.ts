import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'rollup';

const PREFIX = '\0natives:';

/**
 * Handles native Node.js addons (.node files)
 * - Stage 1 (resolve/load): Identifies .node files and generates runtime code.
 * - Stage 2 (generateBundle): Copies the identified .node files to the output dir.
 */
export const nativeModules = (
	distDirectory: string,
): Plugin => {
	const nativeLibsDirectory = `${distDirectory}/natives`;
	// Map<original_path, final_destination_path>
	const modulesToCopy = new Map<string, string>();

	return {
		name: 'native-modules',

		buildStart: () => {
			modulesToCopy.clear();
		},

		async resolveId(source, importer) {
			if (source.startsWith(PREFIX) || !source.endsWith('.node')) {
				return null;
			}

			const resolvedPath = importer
				? path.resolve(path.dirname(importer), source)
				: path.resolve(source);

			try {
				await fs.access(resolvedPath);
			} catch {
				this.warn(`Native module not found: ${resolvedPath}`);
				return null;
			}

			const basename = path.basename(resolvedPath);
			let outputName = basename;
			let counter = 1;

			// Handle name collisions by checking already staged values
			const stagedBasenames = new Set(
				Array.from(modulesToCopy.values()).map(p => path.basename(p)),
			);
			while (stagedBasenames.has(outputName)) {
				const extension = path.extname(basename);
				const name = path.basename(basename, extension);
				outputName = `${name}_${counter}${extension}`;
				counter += 1;
			}

			const destinationPath = path.join(nativeLibsDirectory, outputName);
			modulesToCopy.set(resolvedPath, destinationPath);

			// Return a virtual module ID containing the original path
			return PREFIX + resolvedPath;
		},

		load(id) {
			if (!id.startsWith(PREFIX)) {
				return null;
			}

			const originalPath = id.slice(PREFIX.length);
			const destinationPath = modulesToCopy.get(originalPath);

			if (!destinationPath) {
				// Should not happen if resolveId ran correctly
				return this.error(`Could not find staged native module for: ${originalPath}`);
			}

			// Generate the require path relative to the final bundle directory
			const relativePath = `./${path.relative(distDirectory, destinationPath)}`;

			return `export default require("${relativePath.replaceAll('\\', '/')}");`;
		},

		generateBundle: async () => {
			if (modulesToCopy.size === 0) {
				return;
			}

			// Create the directory once.
			await fs.mkdir(nativeLibsDirectory, { recursive: true });

			// Copy all staged files in parallel.
			await Promise.all(
				Array.from(modulesToCopy.entries()).map(
					([source, destination]) => fs.copyFile(source, destination),
				),
			);
		},
	};
};
