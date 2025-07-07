import type { PackageJson } from 'type-fest';
import type { SrcDistPair } from '../../types.js';
import { applyPublishConfig } from './apply-publish-config.js';
import { getPackageExports } from './get-package-exports.js';
import type { CliEntry } from './cli-input.js';
import { getFileType } from './utils.js';
import type { BuildOutput, EntryPoint } from './types.js';
import { getSourcePath } from './get-source-path.js';

export const getEntryPoints = async (
	srcdist: SrcDistPair[],
	packageJson: PackageJson,
	cliInputs: CliEntry[],
): Promise<EntryPoint[]> => {
	applyPublishConfig(packageJson);

	const packageType = packageJson.type ?? 'commonjs';
	const packageExports = getPackageExports(packageJson, packageType);

	if (cliInputs.length > 0) {
		packageExports.push(...cliInputs.map(input => ({
			...input,
			format: getFileType(input.outputPath) ?? packageType,
		})));
	}

	const mapByOutputPath = new Map<string, BuildOutput>();
	return await Promise.all(
		packageExports.map((exportEntry) => {
			const findDistDirectory = srcdist.find(({ dist }) => exportEntry.outputPath.startsWith(dist));
			if (!findDistDirectory) {
				return {
					exportEntry,
					error: 'Ignoring file outside of dist directories',
				};
			}

			const existingEntry = mapByOutputPath.get(exportEntry.outputPath);
			if (existingEntry) {
				if (existingEntry.format !== exportEntry.format) {
					throw new Error(`Conflicting export types "${existingEntry.format}" & "${exportEntry.format}" found for ${exportEntry.outputPath}`);
				}

				// TODO: Check platform!!
			} else {
				mapByOutputPath.set(exportEntry.outputPath, exportEntry);
			}

			return getSourcePath(exportEntry, findDistDirectory);
		}),
	);
};
