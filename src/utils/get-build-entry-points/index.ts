import type { PackageJson } from 'type-fest';
import type { SrcDistPairInput } from '../../types.js';
import { applyPublishConfig } from './apply-publish-config.js';
import { getPkgEntryPoints } from './get-pkg-entry-points.js';
import type { CliEntry } from './cli-input.js';
import { getFileType } from './utils.js';
import type { BuildOutput, EntryPoint } from './types.js';
import { getSourcePath } from './get-source-path.js';
import { expandBuildOutputWildcards } from './expand-exports-wildcards.js';

export const getBuildEntryPoints = async (
	srcdist: SrcDistPairInput[],
	packageJson: PackageJson,
	cliInputs: CliEntry[],
): Promise<EntryPoint[]> => {
	applyPublishConfig(packageJson);

	const packageType = packageJson.type ?? 'commonjs';

	// Expand wildcard entries in BuildOutput[]
	const packageExports = await expandBuildOutputWildcards(
		getPkgEntryPoints(packageJson, packageType),
		srcdist,
	);

	if (cliInputs.length > 0) {
		packageExports.push(...cliInputs.map(input => ({
			...input,
			format: getFileType(input.outputPath) ?? packageType,
		})));
	}

	const mapByOutputPath = new Map<string, BuildOutput>();
	return await Promise.all(
		packageExports.map(async (exportEntry) => {
			// Pass through error entries from wildcard expansion
			if ('error' in exportEntry) {
				return exportEntry;
			}

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
			} else {
				mapByOutputPath.set(exportEntry.outputPath, exportEntry);
			}

			return await getSourcePath(exportEntry, findDistDirectory);
		}),
	);
};
