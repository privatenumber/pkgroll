import path from 'node:path';
import fs from 'node:fs';
import type { Plugin } from 'rollup';
import { slash } from '../../utils/normalize-path.js';

/**
 * Externalize package imports from the current package so Node.js
 * resolves them at runtime using package.json#imports
 * https://nodejs.org/api/packages.html#subpath-imports
 */
export const externalPkgImports = (): Plugin => {
	// Resolve to canonical path to handle Windows 8.3 short paths
	const cwd = fs.realpathSync.native(process.cwd());
	return {
		name: 'external-pkg-imports',
		resolveId(id, importer) {
			if (id[0] !== '#') {
				return null;
			}

			if (importer) {
				// Get path relative to cwd
				const relativePath = slash(path.relative(cwd, importer));
				// Check if importer is from a dependency (has /node_modules/ path segment)
				const pathSegments = relativePath.split('/');
				if (pathSegments.includes('node_modules')) {
					// Let Node-resolver handle imports maps from dependencies
					return null;
				}
			}

			// Import is from current package, externalize it
			return {
				id,
				external: true,
			};
		},
	};
};
