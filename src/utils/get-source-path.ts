import type { ExportEntry } from '../types';
import { fsExists } from './fs-exists';

const { stringify } = JSON;

async function tryExtensions(
	pathWithoutExtension: string,
	extensions: readonly string[],
) {
	for (const extension of extensions) {
		const pathWithExtension = pathWithoutExtension + extension;
		if (await fsExists(pathWithExtension)) {
			return pathWithExtension;
		}
	}
}

const sourceExtensions = {
	'.d.ts': ['.d.ts', '.ts'],
	'.js': ['.js', '.ts', '.tsx', '.mts', '.cts'],
	'.mjs': ['.mjs', '.js', '.cjs', '.mts', '.cts', '.ts'],
	'.cjs': ['.cjs', '.js', '.mjs', '.mts', '.cts', '.ts'],
} as const;

export async function getSourcePath(
	exportEntry: ExportEntry,
	source: string,
	dist: string,
) {
	const sourcePath = source + exportEntry.outputPath.slice(dist.length);

	for (const extension of (Object.keys(sourceExtensions) as (keyof typeof sourceExtensions)[])) {
		if (exportEntry.outputPath.endsWith(extension)) {
			const resolvedSourcePath = await tryExtensions(
				sourcePath.slice(0, -extension.length),
				sourceExtensions[extension],
			);

			if (resolvedSourcePath) {
				return resolvedSourcePath;
			}
		}
	}

	throw new Error(`Could not find matching source file for export path ${stringify(exportEntry.outputPath)}`);
}
