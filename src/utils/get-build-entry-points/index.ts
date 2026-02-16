import type { PackageJson } from 'type-fest';
import picomatch from 'picomatch';
import type { SrcDistPairInput } from '../../types.js';
import { applyPublishConfig } from './apply-publish-config.js';
import { getPkgEntryPoints } from './get-pkg-entry-points.js';
import type { CliEntry } from './cli-input.js';
import { getFileType } from './utils.js';
import type { BuildOutput, EntryPoint, EntryPointError } from './types.js';
import { getSourcePath } from './get-source-path.js';
import { expandBuildOutputWildcards } from './expand-exports-wildcards.js';

type ExpandedEntry = BuildOutput | EntryPointError<BuildOutput>;

export const getBuildEntryPoints = async (
	srcdist: SrcDistPairInput[],
	packageJson: PackageJson,
	cliInputs: CliEntry[],
	packageJsonFilters?: string[],
): Promise<EntryPoint[]> => {
	applyPublishConfig(packageJson);

	const packageType = packageJson.type ?? 'commonjs';

	const skipPackageJson = packageJsonFilters?.includes('false');
	let packageExports: ExpandedEntry[] = [];

	if (!skipPackageJson) {
		// Expand wildcard entries in BuildOutput[]
		packageExports = await expandBuildOutputWildcards(
			getPkgEntryPoints(packageJson, packageType),
			srcdist,
		);

		// Filter by glob patterns against output paths
		const filters = packageJsonFilters?.filter(filter => filter !== 'false');
		if (filters && filters.length > 0) {
			// matchBase only applies to patterns without slashes (basename-only)
			const matchers = filters.map(
				filter => picomatch(filter, filter.includes('/') ? {} : { matchBase: true }),
			);
			packageExports = packageExports.filter((entry) => {
				const buildOutput = 'error' in entry ? entry.exportEntry : entry;
				const outputPath = buildOutput.outputPath.replace(/^\.\//, '');
				return matchers.some(isMatch => isMatch(outputPath));
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
