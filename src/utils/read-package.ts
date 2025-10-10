import fs from 'node:fs';
import path from 'node:path';
import type { PackageJson } from 'type-fest';
import { fsExists } from './fs-exists.js';
import { formatPath } from './log.js';
import { parse as yamlParse } from 'yaml';

export const readPackage = async (directoryPath: string) => {
	const packageYamlPath = path.join(directoryPath, 'package.yaml');
	const packageJsonPath = path.join(directoryPath, 'package.json');

	let packagePath: string;
	let packageObj: PackageJson;

	if (await fsExists(packageYamlPath)) {
		packagePath = packageYamlPath;

		const packageYamlString = await fs.promises.readFile(packageYamlPath, 'utf8');

		try {
			packageObj = yamlParse(packageYamlString);
		} catch (error) {
			throw new Error(`Failed to parse ${formatPath(packageYamlPath)}: ${(error as Error).message}`);
		}
	} else if (await fsExists(packageJsonPath)) {
		packagePath = packageJsonPath;

		const packageJsonString = await fs.promises.readFile(packageJsonPath, 'utf8');

		try {
			packageObj = JSON.parse(packageJsonString);
		} catch (error) {
			throw new Error(`Failed to parse ${formatPath(packageJsonPath)}: ${(error as Error).message}`);
		}
	} else {
		throw new Error(`package.json not found at: ${packageJsonPath} (also checked for package.yaml)`);
	}

	return {
		packageJson: packageObj,
		packageJsonPath: packagePath,
	};
};
