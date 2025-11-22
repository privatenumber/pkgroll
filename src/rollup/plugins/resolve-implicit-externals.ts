import path from 'node:path';
import fs from 'node:fs/promises';
import type { Plugin } from 'rollup';
import { up } from 'empathic/find';
import { fsExists } from '../../utils/fs-exists.js';
import { slash } from '../../utils/normalize-path.js';
import {
	parseSpecifier,
	isBareSpecifier,
} from '../../utils/import-specifier.js';
import { readPackageJson } from '../../utils/read-package.js';

/**
 * Try to resolve a file with implicit extensions (.js, .json)
 * or as a directory (index.js, package.json main field)
 */
const tryResolveImplicit = async (basePath: string): Promise<string | null> => {
	// Try exact path first
	const stats = await fs.stat(basePath).catch(() => {});
	if (stats) {
		if (stats.isFile()) { return basePath; }
		if (stats.isDirectory()) {
			// Try directory resolution: index.js, then index.json
			const indexJs = path.join(basePath, 'index.js');
			if (await fsExists(indexJs)) {
				return indexJs;
			}

			const indexJson = path.join(basePath, 'index.json');
			if (await fsExists(indexJson)) {
				return indexJson;
			}
		}
	}

	// Try with .js extension
	const jsPath = `${basePath}.js`;
	if (await fsExists(jsPath)) {
		return jsPath;
	}

	// Try with .json extension
	const jsonPath = `${basePath}.json`;
	if (await fsExists(jsonPath)) {
		return jsonPath;
	}

	return null;
};

/**
 * Resolve implicit extensions for externalized package imports.
 *
 * This plugin runs BEFORE externalizeDependencies to check if externalized
 * imports need explicit extensions added for Node.js compatibility.
 *
 * For packages without `exports`, Node.js doesn't support extensionless imports:
 * - `external-pkg/file` fails in Node.js
 * - `external-pkg/file.js` works
 *
 * This plugin:
 * 1. Uses this.resolve() to check if import will be externalized
 * 2. For externalized bare specifiers with subpaths, checks if package has `exports`
 * 3. If no exports, resolves the file with implicit extensions
 * 4. Rewrites the import to include the explicit path
 */
export const resolveImplicitExternals = (): Plugin => ({
	name: 'resolve-implicit-externals',
	async resolveId(id, importer, options) {
		// Only process bare specifiers
		if (!isBareSpecifier(id)) {
			return null;
		}

		// Extract package name and subpath
		const [packageName, subpath] = parseSpecifier(id);

		// Only process packages with subpaths
		if (!subpath) {
			return null;
		}

		// Check if this import will be externalized by calling this.resolve()
		const resolved = await this.resolve(id, importer, {
			...options,
			skipSelf: true,
		});

		// If not resolved or not external, skip
		if (!resolved || !resolved.external) {
			return null;
		}

		// Find the package in node_modules
		const startDir = importer ? path.dirname(importer) : process.cwd();
		const packageJsonPath = up(`node_modules/${packageName}/package.json`, { cwd: startDir });
		if (!packageJsonPath) {
			// Package not found - let externalizeDependencies handle it
			return null;
		}

		// Read package.json to check for exports field
		const pkgJson = await readPackageJson(packageJsonPath);
		const packageDir = path.dirname(packageJsonPath);

		// If package has exports, let Node.js handle resolution
		if (pkgJson.exports) {
			return null;
		}

		// No exports - try to resolve with implicit extensions
		const subpathFullPath = path.join(packageDir, subpath);
		const resolvedPath = await tryResolveImplicit(subpathFullPath);

		if (!resolvedPath) {
			// File not found - let externalizeDependencies handle it
			return null;
		}

		// Extract the relative path from package directory
		const relativePath = slash(path.relative(packageDir, resolvedPath));
		const externalPath = `${packageName}/${relativePath}`;

		return {
			id: externalPath,
			external: true,
		};
	},
});
