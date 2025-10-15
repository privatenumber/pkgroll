import fs from 'node:fs/promises';
import path from 'node:path';
import type { PackageJson } from 'type-fest';
import { parse as yamlParse } from 'yaml';
import { fsExists } from './fs-exists.js';
import { formatPath } from './log.js';

const readPackageYaml = async (
	packageYamlPath: string,
): Promise<PackageJson> => {
	const packageYamlString = await fs.readFile(packageYamlPath, 'utf8');

	try {
		return yamlParse(packageYamlString);
	} catch (error) {
		throw new Error(`Failed to parse ${formatPath(packageYamlPath)}: ${(error as Error).message}`);
	}
};

const readPackageJson = async (
	packageJsonPath: string,
): Promise<PackageJson> => {
	const packageJsonString = await fs.readFile(packageJsonPath, 'utf8');

	try {
		return JSON.parse(packageJsonString);
	} catch (error) {
		throw new Error(`Failed to parse ${formatPath(packageJsonPath)}: ${(error as Error).message}`);
	}
};

export const readPackage = async (directoryPath: string) => {
	const packageYamlPath = path.join(directoryPath, 'package.yaml');

	if (await fsExists(packageYamlPath)) {
		const packageJson = await readPackageYaml(packageYamlPath);
		return {
			packageJson,
			packageJsonPath: packageYamlPath,
		};
	}

	const packageJsonPath = path.join(directoryPath, 'package.json');
	if (await fsExists(packageJsonPath)) {
		const packageJson = await readPackageJson(packageJsonPath);
		return {
			packageJson,
			packageJsonPath,
		};
	}

	throw new Error(`package.json not found at: ${packageJsonPath} (also checked for package.yaml)`);
};
