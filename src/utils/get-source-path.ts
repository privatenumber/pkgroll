import { globSync } from 'glob';
import type { ExportEntry } from '../types.js';
import { fsExists } from './fs-exists.js';

const { stringify } = JSON;

const tryExtensions = async (
	pathWithoutExtension: string,
	extensions: readonly string[],
	checker: (sourcePath: string)=>Promise<boolean>,
) => {
	for (const extension of extensions) {
		const pathWithExtension = pathWithoutExtension + extension;
		if (await checker(pathWithExtension)) {
			return {
				extension,
				path: pathWithExtension,
			};
		}
	}
};

const extensionMap = {
	'.d.ts': ['.d.ts', '.d.mts', '.d.cts', '.ts', '.mts', '.cts'],
	'.d.mts': ['.d.mts', '.d.ts', '.d.cts', '.ts', '.mts', '.cts'],
	'.d.cts': ['.d.cts', '.d.ts', '.d.mts', '.ts', '.mts', '.cts'],
	'.js': ['.js', '.ts', '.tsx', '.mts', '.cts'],
	'.mjs': ['.mjs', '.js', '.cjs', '.mts', '.cts', '.ts'],
	'.cjs': ['.cjs', '.js', '.mjs', '.mts', '.cts', '.ts'],
} as const;

const distExtensions = Object.keys(extensionMap) as (keyof typeof extensionMap)[];

export const getSourcePath = async (
	exportEntry: ExportEntry,
	source: string,
	dist: string,
	checker: (sourcePath: string)=>Promise<boolean> = fsExists,
): Promise<Omit<SourcePath, 'exportEntry'>> => {
	const sourcePathUnresolved = source + exportEntry.outputPath.slice(dist.length);

	for (const distExtension of distExtensions) {
		if (exportEntry.outputPath.endsWith(distExtension)) {
			const sourcePath = await tryExtensions(
				sourcePathUnresolved.slice(0, -distExtension.length),
				extensionMap[distExtension],
				checker,
			);

			if (sourcePath) {
				return {
					input: sourcePath.path,
					srcExtension: sourcePath.extension,
					distExtension,
				};
			}
		}
	}

	throw new Error(`Could not find matching source file for export path ${stringify(exportEntry.outputPath)}`);
};

interface SourcePath {
	exportEntry: ExportEntry;
	input: string;
	srcExtension: string;
	distExtension: string;
}

export const getSourcePaths = async (
	exportEntry: ExportEntry,
	sourcePath: string,
	distPath: string,
	cwd: string,
): Promise<SourcePath[]> => {
	if (exportEntry.outputPath.includes('*')) {
		// use glob to resolve matches from the packageJsonRoot directory
		const matchSet = new Set<string>();
		const sourceMatch = await getSourcePath(exportEntry, sourcePath, distPath, async (path) => {
			const matches = globSync(path, { cwd });
			for (const match of matches) { matchSet.add(match); }
			return matches.length > 0; // always return false to prevent early exit
		});

		const matchedPaths = Array.from(matchSet);

		const allMatches = matchedPaths.map(match => ({
			exportEntry,
			input: match,
			srcExtension: sourceMatch.srcExtension,
			distExtension: sourceMatch.distExtension,
		}));

		return allMatches;
	}

	return [{
		exportEntry,
		...await getSourcePath(exportEntry, sourcePath, distPath, fsExists),
	}];
};
