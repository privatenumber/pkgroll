import type { ExportEntry } from '../types.js';
import { fsExists } from './fs-exists.js';

const { stringify } = JSON;

const tryExtensions = async (
	pathWithoutExtension: string,
	extensions: readonly string[],
) => {
	for (const extension of extensions) {
		const pathWithExtension = pathWithoutExtension + extension;
		if (await fsExists(pathWithExtension)) {
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
) => {
	const sourcePathUnresolved = source + exportEntry.outputPath.slice(dist.length);

	for (const distExtension of distExtensions) {
		if (exportEntry.outputPath.endsWith(distExtension)) {
			const sourcePath = await tryExtensions(
				sourcePathUnresolved.slice(0, -distExtension.length),
				extensionMap[distExtension],
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
