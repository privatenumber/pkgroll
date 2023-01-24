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

		if (externalDependenciesObject) {
			const packageNames = Object.keys(externalDependenciesObject);
			externalDependencies.push(...packageNames);

			for (const packageName of packageNames) {
				if (packageName.startsWith(typesPrefix)) {
					let originalPackageName = packageName.slice(typesPrefix.length);

					if (originalPackageName.includes('__')) {
						originalPackageName = `@${originalPackageName.replace('__', '/')}`;
					}

					externalDependencies.push(originalPackageName);
				}
			}
		}
	}

	return externalDependencies;
};
