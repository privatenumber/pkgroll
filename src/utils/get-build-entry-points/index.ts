import type { PackageJson } from 'type-fest';
import type { SrcDistPairInput } from '../../types.js';
import { applyPublishConfig } from './apply-publish-config.js';
import { getPkgEntryPoints } from './get-pkg-entry-points.js';
import type { CliEntry } from './cli-input.js';
import { getFileType } from './utils.js';
import type { BuildOutput, EntryPoint, ObjectPath } from './types.js';
import { getSourcePath } from './get-source-path.js';
import { expandBuildOutputWildcards } from './expand-exports-wildcards.js';
import { parseDotPath } from './parse-dot-path.js';

const matchesPathPrefix = (
	sourcePath: ObjectPath,
	filterSegments: string[],
) => {
	if (filterSegments.length > sourcePath.length) {
		return false;
	}
	return filterSegments.every(
		(segment, index) => String(sourcePath[index]) === segment,
	);
};

export const getBuildEntryPoints = async (
	srcdist: SrcDistPairInput[],
	packageJson: PackageJson,
	cliInputs: CliEntry[],
	packageJsonFilters?: string[],
): Promise<EntryPoint[]> => {
	applyPublishConfig(packageJson);

	const packageType = packageJson.type ?? 'commonjs';

	const skipPackageJson = packageJsonFilters?.includes('false');
	let packageExports: BuildOutput[] = [];

	if (!skipPackageJson) {
		// Expand wildcard entries in BuildOutput[]
		packageExports = await expandBuildOutputWildcards(
			getPkgEntryPoints(packageJson, packageType),
			srcdist,
		);

		// Filter by dot-path prefixes if specified
		const filters = packageJsonFilters?.filter(filter => filter !== 'false');
		if (filters && filters.length > 0) {
			const parsedFilters = filters.map(parseDotPath);
			packageExports = packageExports.filter((entry) => {
				if ('error' in entry) {
					return false;
				}
				const { source } = entry;
				if (source === 'cli') {
					return true;
				}
				return parsedFilters.some(
					filterSegments => matchesPathPrefix(source.path, filterSegments),
				);
			});
		}
	}

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
