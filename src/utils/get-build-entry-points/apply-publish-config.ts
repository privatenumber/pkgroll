import type { PackageJson } from 'type-fest';

// Prefer publishConfig when defined
// https://pnpm.io/package_json#publishconfig
export const applyPublishConfig = (packageJson: PackageJson) => {
	const { publishConfig } = packageJson;
	if (!publishConfig) {
		return;
	}

	const overwriteFields = [
		'bin',
		'main',
		'exports',
		'types',
		'module',
	];

	for (const field of overwriteFields) {
		if (publishConfig[field]) {
			packageJson[field] = publishConfig[field];
		}
	}
};
