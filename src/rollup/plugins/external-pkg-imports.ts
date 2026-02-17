import fs from 'node:fs';
import type { Plugin } from 'rollup';
import { isFromNodeModules } from '../../utils/import-specifier.ts';

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

			if (importer && isFromNodeModules(importer, cwd)) {
				// Let Node-resolver handle imports maps from dependencies
				return null;
			}

			// Import is from current package, externalize it
			return {
				id,
				external: true,
			};
		},
	};
};
