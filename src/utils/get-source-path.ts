import { globSync } from "glob";
import type { ExportEntry } from '../types.js';
import { fsExists } from './fs-exists.js';

const { stringify } = JSON;

const tryExtensions = (
	pathWithoutExtension: string,
	extensions: readonly string[],
	checker: (sourcePath: string)=>boolean
) => {
	for (const extension of extensions) {
		const pathWithExtension = pathWithoutExtension + extension;
		if (checker(pathWithExtension)) {
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

interface SourcePath {
	exportEntry: ExportEntry,
	input: string;
	srcExtension: string;
	distExtension: string;
}

export const getSourcePathFromDistPath = (
	distPath: string,
	source: string,
	dist: string,
	checker: (sourcePath: string)=>boolean = fsExists
): Omit<SourcePath, "exportEntry"> => {
	const sourcePathUnresolved = source + distPath.slice(dist.length);

	for (const distExtension of distExtensions) {
		if (distPath.endsWith(distExtension)) {
			const sourcePath = tryExtensions(
				sourcePathUnresolved.slice(0, -distExtension.length),
				extensionMap[distExtension],
				checker
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

	throw new Error(`Could not find matching source file for export path ${stringify(distPath)}`);
};


export const getSourcePath = (
	exportEntry: ExportEntry,
	sourcePath: string,
	distPath: string,
	cwd: string
): SourcePath[] =>{
	const outputPath = exportEntry.outputPath;
	if(exportEntry.outputPath.includes('*')){

		// use glob to resolve matches from the packageJsonRoot directory
		const matchSet = new Set<string>();
		const sourceMatch = getSourcePathFromDistPath(outputPath, sourcePath, distPath, (path)=>{
			const matches = globSync(path, { cwd });
			for(const match of matches) matchSet.add(match);
			return matches.length > 0; // always return false to prevent early exit
		});

		const matchedPaths = Array.from(matchSet);

		const allMatches = matchedPaths.map(match => ({
			exportEntry,
			input: match,
			srcExtension: sourceMatch.srcExtension,
			distExtension: sourceMatch.distExtension
		}))

		return allMatches
	}
	return [{
		exportEntry,
		...getSourcePathFromDistPath(exportEntry.outputPath, sourcePath, distPath, fsExists)
	}]
}

export const distToSourcePath = (path: string, sourcePath: string, distPath: string) => {
	return sourcePath + path.slice(distPath.length);
}

export const sourceToDistPath = (path: string, sourcePath: string, distPath: string) => {
	return distPath + path.slice(sourcePath.length);
}
