import type { PackageJson } from 'type-fest';

const externalProperties = [
	'peerDependencies',
	'dependencies',
	'optionalDependencies',
] as const;

export const getExternalDependencies = (packageJson: PackageJson) => {
	const externalDependencies = [];

	for (const property of externalProperties) {
		const externalDependenciesObject = packageJson[property];

		if (externalDependenciesObject) {
			externalDependencies.push(...Object.keys(externalDependenciesObject));
		}
	}

	return externalDependencies;
};
