import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'rollup';

const PREFIX = '\0natives:';

/**
 * Handles native Node.js addons (.node files)
 * - Detects imports of .node files
 * - Copies them to natives directory
 * - Rewrites imports to use createRequire for ESM compatibility
 */
export const nativeModules = (
	distDirectory: string,
): Plugin => {
	const nativeLibsDirectory = `${distDirectory}/natives`;
	const copiedModules = new Map<string, string>();

	return {
		name: 'native-modules',

		buildStart: () => {
			// Reset for watch mode
			copiedModules.clear();
		},

		resolveId(source, importer) {
			// Handle already-prefixed IDs
			if (source.startsWith(PREFIX)) {
				return source;
			}

			// Check if this is a .node file import
			if (!source.endsWith('.node')) {
				return null;
			}

			// Resolve the full path to the .node file
			const resolvedPath = importer
				? path.resolve(path.dirname(importer), source)
				: path.resolve(source);

			// Check if file exists
			if (!fs.existsSync(resolvedPath)) {
				this.warn(`Native module not found: ${resolvedPath}`);
				return null;
			}

			// Generate output filename (preserve original name)
			const basename = path.basename(resolvedPath);
			let outputName = basename;
			let counter = 1;

			// Handle name collisions
			while (Array.from(copiedModules.values()).includes(outputName)) {
				const extension = path.extname(basename);
				const name = path.basename(basename, extension);
				outputName = `${name}_${counter}${extension}`;
				counter += 1;
			}

			const destinationPath = path.join(nativeLibsDirectory, outputName);
			const relativePath = `./natives/${outputName}`;

			// Store mapping
			copiedModules.set(resolvedPath, relativePath);

			// Create directory and copy file
			fs.mkdirSync(nativeLibsDirectory, { recursive: true });
			fs.copyFileSync(resolvedPath, destinationPath);

			// Return prefixed ID for the load hook
			return PREFIX + relativePath;
		},

		load(id) {
			if (!id.startsWith(PREFIX)) {
				return null;
			}

			const relativePath = id.slice(PREFIX.length);

			// Generate code that uses createRequire for ESM compatibility
			return `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
export default require(${JSON.stringify(relativePath)});
`;
		},
	};
};
