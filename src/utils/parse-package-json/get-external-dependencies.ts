import type { PackageJson } from 'type-fest';

const externalProperties = [
	'peerDependencies',
	'dependencies',
	'optionalDependencies',
] as const;

const typesPrefix = '@types/';

export const getExternalDependencies = (packageJson: PackageJson) => {
	const externalDependencies = [];

	for (const property of externalProperties) {
		const externalDependenciesObject = packageJson[property];

		if (!externalDependenciesObject) {
			continue;
		}

		const packageNames = Object.keys(externalDependenciesObject);
		externalDependencies.push(...packageNames);

		for (const packageName of packageNames) {
			/**
			 * @types/ is externalized, the original should be externalized too
			 * e.g. If '@types/react' is externalized, 'react' will be too
			 * Because `@types/react` is imported via 'react' in the source
			 *
			 * This is primarily designed for @types/estree, which doesn't
			 * actually have a runtime package. It's a type-only package.
			 */
			if (packageName.startsWith(typesPrefix)) {
				let originalPackageName = packageName.slice(typesPrefix.length);

				if (originalPackageName.includes('__')) {
					originalPackageName = `@${originalPackageName.replace('__', '/')}`;
				}

				externalDependencies.push(originalPackageName);
			}
		}
	}

	return externalDependencies;
};
