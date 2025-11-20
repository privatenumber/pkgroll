import path from 'node:path';
import fs from 'node:fs';
import type { Plugin } from 'rollup';
import type { PackageJson } from 'type-fest';
import { slash } from '../../utils/normalize-path.js';
import { isFromNodeModules } from '../../utils/is-from-node-modules.js';

const typesPrefix = '@types/';

/**
 * Convert a package name to its @types equivalent
 * Examples:
 * - 'react' → '@types/react'
 * - '@scoped/package' → '@types/scoped__package'
 */
const getAtTypesPackageName = (packageName: string): string => {
	if (packageName[0] === '@') {
		// Scoped package: @scoped/package → @types/scoped__package
		return `${typesPrefix}${packageName.slice(1).replace('/', '__')}`;
	}
	return `${typesPrefix}${packageName}`;
};

/**
 * Convert a @types package name to its original package name
 * Examples:
 * - '@types/react' → 'react'
 * - '@types/scoped__package' → '@scoped/package'
 */
const getOriginalPackageName = (typePackageName: string): string => {
	const originalName = typePackageName.slice(typesPrefix.length);

	// Handle scoped packages: @types/scoped__package → @scoped/package
	if (originalName.includes('__')) {
		return `@${originalName.replace('__', '/')}`;
	}

	return originalName;
};

/**
 * Extract package name from import specifier
 * Examples:
 * - 'foo' → 'foo'
 * - 'foo/bar' → 'foo'
 * - '@org/pkg' → '@org/pkg'
 * - '@org/pkg/sub' → '@org/pkg'
 */
const extractPackageName = (specifier: string): string => {
	const firstSlash = specifier.indexOf('/');
	if (firstSlash === -1) {
		return specifier;
	}

	if (specifier[0] === '@') {
		// Scoped package: @org/package[/subpath]
		const secondSlash = specifier.indexOf('/', firstSlash + 1);
		return secondSlash === -1
			? specifier
			: specifier.slice(0, secondSlash);
	}

	// Regular package: package[/subpath]
	return specifier.slice(0, firstSlash);
};

/**
 * Check if a specifier is a bare specifier (not relative or absolute)
 */
const isBareSpecifier = (id: string): boolean => {
	const firstCharacter = id[0];
	return !(
		firstCharacter === '.'
		|| firstCharacter === '/'
		|| firstCharacter === '#'
		|| path.isAbsolute(id)
	);
};

const dependencyTypes = ['peerDependencies', 'dependencies', 'optionalDependencies'] as const;

/**
 * Externalize dependencies based on package.json classification.
 *
 * - dependencies/peerDependencies/optionalDependencies: externalized
 * - devDependencies ONLY: error if not resolvable, bundle if resolvable
 * - unlisted: warn and bundle
 */
export const externalizeDependencies = (
	packageJson: PackageJson,
	pluginOptions?: {

		/**
		 * Skip warnings for unlisted dependencies.
		 * Useful for type declaration builds where imports may not match runtime dependencies.
		 */
		skipUnlistedWarnings?: boolean;

		/**
		 * Whether this is for types builds.
		 * When true, enables @types package warnings.
		 */
		forTypes?: boolean;
	},
): Plugin => {
	// Resolve to canonical path to handle Windows 8.3 short paths
	const cwd = fs.realpathSync.native(process.cwd());

	// Build sets for quick lookup
	const runtimeDependencies = new Set<string>();
	const devDeps = new Set<string>(Object.keys(packageJson.devDependencies || {}));

	// External dependencies (always externalized)
	for (const property of dependencyTypes) {
		const deps = packageJson[property];
		if (deps) {
			for (const packageName of Object.keys(deps)) {
				runtimeDependencies.add(packageName);

				/**
				 * "@types/name" packages are imported as "name" in source
				 * e.g. '@types/react' is imported as 'react'
				 *
				 * This was motivated by @types/estree, which doesn't
				 * actually have a runtime package. It's a type-only package.
				 */
				if (packageName.startsWith(typesPrefix)) {
					runtimeDependencies.add(getOriginalPackageName(packageName));
				}
			}
		}
	}

	return {
		name: 'externalize-dependencies',
		async resolveId(id, importer, options) {
			// Only process bare specifiers
			if (!isBareSpecifier(id)) {
				return null;
			}

			// Extract package name (handle @scoped/package)
			const packageName = extractPackageName(id);

			// 1. External dependencies → externalize (always, even from node_modules)
			if (runtimeDependencies.has(packageName)) {
				// Check if @types package is in devDependencies while runtime package is externalized
				// Only warn when building types (not for JS-only builds)
				if (pluginOptions?.forTypes) {
					const typePackageName = getAtTypesPackageName(packageName);
					if (devDeps.has(typePackageName)) {
						console.warn(
							`Recommendation: "${typePackageName}" is bundled (devDependencies) but "${packageName}" is externalized. Place "${typePackageName}" in dependencies/peerDependencies as well so users don't have missing types.`,
						);
					}
				}

				return {
					id,
					external: true,
				};
			}

			// // Only process imports from source (not from node_modules) for dev/unlisted deps
			// if (importer && isFromNodeModules(importer, cwd)) {
			// 	return null;
			// }

			if (devDeps.has(packageName)) {
				// Check that it's resolvable first
				const resolved = await this.resolve(id, importer, {
					...options,
					skipSelf: true,
				});

				// If unresolvable, error
				if (!resolved) {
					const errorMessage = `Could not resolve "${id}" even though it's declared in package.json. Try re-installing node_modules.`;
					console.error(errorMessage);
					throw new Error(errorMessage);
				}

				// Check if @types package is externalized while runtime package will be bundled
				// Only warn when building types (not for JS-only builds)
				if (pluginOptions?.forTypes) {
					const typePackageName = getAtTypesPackageName(packageName);
					if (runtimeDependencies.has(typePackageName)) {
						console.warn(
							`Recommendation: "${typePackageName}" is externalized but "${packageName}" is bundled (devDependencies). This may cause type mismatches for consumers. Consider moving "${packageName}" to dependencies or "${typePackageName}" to devDependencies.`,
						);
					}
				}

				return resolved;
			}

			// 3. Not listed → warn and bundle
			if (importer && !isFromNodeModules(importer, cwd) && !pluginOptions?.skipUnlistedWarnings) {
				console.warn(
					`"${packageName}" imported by "${slash(importer)}" but not declared in package.json. Will be bundled to prevent failure at runtime.`,
				);
			}

			return null;
		},
	};
};
