import path from 'path';
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
	'.js': ['.js', '.ts', '.tsx'],
	'.mjs': ['.mjs', '.js', '.mts', '.ts'],
	'.cjs': ['.cjs', '.js', '.cts', '.ts'],
} as const;

export async function getSourcePath(
	exportEntry: ExportEntry,
	source: string,
	dist: string,
) {
	if (!exportEntry.outputPath.startsWith(dist)) {
		throw new Error(`Export path ${stringify(exportEntry.outputPath)} from ${stringify(`package.json#${exportEntry.from}`)} is not in directory ${dist}`);
	}

	const sourcePath = path.join(source, exportEntry.outputPath.slice(dist.length));

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

	throw new Error(`Could not find mathing source file for export path ${stringify(exportEntry.outputPath)}`);
}
