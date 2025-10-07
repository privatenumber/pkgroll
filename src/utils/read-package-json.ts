import fs from 'node:fs';
import path from 'node:path';
import type { PackageJson } from 'type-fest';
import { fsExists } from './fs-exists.js';
import { formatPath } from './log.js';

export const readPackageJson = async (directoryPath: string) => {
	const packageJsonPath = path.join(directoryPath, 'package.json');

	const exists = await fsExists(packageJsonPath);
	if (!exists) {
		throw new Error(`package.json not found at: ${packageJsonPath}`);
	}

	const packageJsonString = await fs.promises.readFile(packageJsonPath, 'utf8');

	let packageJson: PackageJson;
	try {
		packageJson = JSON.parse(packageJsonString);
	} catch (error) {
		// TODO: add test
		throw new Error(`Failed to parse ${formatPath(packageJsonPath)}: ${(error as Error).message}`);
	}

	return {
		packageJson,
		packageJsonPath,
	};
};
