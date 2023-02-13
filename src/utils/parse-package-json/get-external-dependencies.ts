import type { PackageJson } from 'type-fest';

const externalProperties = [
	'peerDependencies',
	'dependencies',
	'optionalDependencies',
] as const;

const typesPrefix = '@types/';

export const getExternalDependencies = (
	packageJson: PackageJson,
	aliases: Record<string, unknown>,
	forTypes = false,
) => {
	const externalDependencies = [];
	const { devDependencies } = packageJson;

	for (const property of externalProperties) {
		const externalDependenciesObject = packageJson[property];

		if (!externalDependenciesObject) {
			continue;
		}

		const packageNames = Object.keys(externalDependenciesObject);

		for (const packageName of packageNames) {
			if (packageName in aliases) {
				continue;
			}

			/**
			 * "@types/name" is imported in source as "name"
			 * e.g. '@types/react' is imported as 'react'
			 *
			 * This was motivated by @types/estree, which doesn't
			 * actually have a runtime package. It's a type-only package.
			 */
			if (packageName.startsWith(typesPrefix)) {
				if (forTypes) {
					let originalPackageName = packageName.slice(typesPrefix.length);

					if (originalPackageName.includes('__')) {
						originalPackageName = `@${originalPackageName.replace('__', '/')}`;
					}

					externalDependencies.push(originalPackageName);
				}
			} else {
				if (devDependencies && forTypes) {
					const typePackageName = typesPrefix + packageName.replace('@', '').replace('/', '__');
					if (
						devDependencies[typePackageName]
						&& !(typePackageName in externalDependenciesObject)
					) {
						console.warn(`Recommendation: "${typePackageName}" is externalized because "${packageName}" is in "${property}". Place "${typePackageName}" in "${property}" as well so users don't have missing types.`);
					}
				}

				externalDependencies.push(packageName);
			}
		}
	}

	return externalDependencies.flatMap(dependency => [
		dependency,
		new RegExp(`^${dependency}/`),
	]);
};
