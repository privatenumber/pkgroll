import path from 'node:path';
import type { Plugin } from 'rollup';
import type { PackageJson } from 'type-fest';

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

const dependencyTypes = ['peerDependencies', 'dependencies', 'optionalDependencies'] as const;

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

/**
 * Externalize dependencies listed in package.json
 * (dependencies, peerDependencies, optionalDependencies)
 */
export const externalizeDependencies = (
	packageJson: PackageJson,
	forTypes = false,
): Plugin => {
	const externalDependencies = new Set<string>();
	const { devDependencies } = packageJson;

	for (const property of dependencyTypes) {
		const externalDependenciesObject = packageJson[property];

		if (!externalDependenciesObject) {
			continue;
		}

		const packageNames = Object.keys(externalDependenciesObject);

		for (const packageName of packageNames) {
			/**
			 * "@types/name" is imported in source as "name"
			 * e.g. '@types/react' is imported as 'react'
			 *
			 * This was motivated by @types/estree, which doesn't
			 * actually have a runtime package. It's a type-only package.
			 */
			if (packageName.startsWith(typesPrefix)) {
				if (forTypes) {
					const originalPackageName = getOriginalPackageName(packageName);
					externalDependencies.add(originalPackageName);
				}
			} else {
				if (devDependencies && forTypes) {
					const typePackageName = getAtTypesPackageName(packageName);
					if (
						devDependencies[typePackageName]
						&& !(typePackageName in externalDependenciesObject)
					) {
						console.warn(`Recommendation: "${typePackageName}" is externalized because "${packageName}" is in "${property}". Place "${typePackageName}" in "${property}" as well so users don't have missing types.`);
					}
				}

				externalDependencies.add(packageName);
			}
		}
	}

	return {
		name: 'externalize-dependencies',
		resolveId(id) {
			// Only check bare specifiers (skip relative/absolute paths)
			if (!isBareSpecifier(id)) {
				return null;
			}

			// Extract the package name (handles subpaths and scoped packages)
			const packageName = extractPackageName(id);

			// Check if this package is in external dependencies
			if (externalDependencies.has(packageName)) {
				return {
					id,
					external: true,
				};
			}

			return null;
		},
	};
};
