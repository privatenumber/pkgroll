import type { PackageJson } from 'type-fest';
import { getExportEntries } from './get-export-entries.js';
import type { ExportEntry, EntryPoint } from './types.js';
import { getSourcePath } from './get-source-path.js';

const { stringify } = JSON;

export const getEntryPoints = async (
	sourcePath: string,
	distPath: string,
	packageJson: PackageJson,
	cliInputs: ExportEntry[],
) => {
	let exportEntries = getExportEntries(packageJson);

	if (cliInputs.length > 0) {
		const packageType = packageJson.type ?? 'commonjs';
		exportEntries.push(...cliInputs.map((input) => {
			if (!input.type) {
				input.type = packageType;
			}
			return input;
		}));
	}

	exportEntries = exportEntries.filter((entry) => {
		const validPath = entry.outputPath.startsWith(distPath);

		if (!validPath) {
			console.warn(`Ignoring entry outside of ${distPath} directory: package.json#${entry.from}=${stringify(entry.outputPath)}`);
		}

		return validPath;
	});

	const entryPoints: EntryPoint[] = [];
	await Promise.all(exportEntries.map(async (exportEntry) => {
		const entryPoint = await getSourcePath(exportEntry, sourcePath, distPath);
		if (entryPoint) {
			entryPoints.push(entryPoint);
		}
	}));
	return entryPoints;
};
