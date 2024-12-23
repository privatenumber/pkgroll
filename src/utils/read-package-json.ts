import fs from 'node:fs';
import path from 'node:path';
import type { PackageJson } from 'type-fest';
import { fsExists } from './fs-exists.js';

export const readPackageJson = async (directoryPath: string): Promise<PackageJson> => {
	const packageJsonPath = path.join(directoryPath, 'package.json');

	const exists = await fsExists(packageJsonPath);

	if (!exists) {
		throw new Error(`package.json not found at: ${packageJsonPath}`);
	}

	const packageJsonString = await fs.promises.readFile(packageJsonPath, 'utf8');

	try {
		return JSON.parse(packageJsonString);
	} catch (error) {
		throw new Error(`Cannot parse package.json: ${(error as Error).message}`);
	}
};
