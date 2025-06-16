import { fsExists } from '../fs-exists.js';
import type { ExportEntry, EntryPoint } from './types.js';

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
	'.d.ts': ['.d.ts', '.d.mts', '.d.cts', '.ts', '.tsx', '.mts', '.cts'],
	'.d.mts': ['.d.mts', '.d.ts', '.d.cts', '.ts', '.tsx', '.mts', '.cts'],
	'.d.cts': ['.d.cts', '.d.ts', '.d.mts', '.ts', '.tsx', '.mts', '.cts'],
	'.js': ['.js', '.ts', '.tsx', '.mts', '.cts'],
	'.mjs': ['.mjs', '.js', '.cjs', '.mts', '.cts', '.ts', '.tsx'],
	'.cjs': ['.cjs', '.js', '.mjs', '.mts', '.cts', '.ts', '.tsx'],
} as const;

const distExtensions = Object.keys(extensionMap) as (keyof typeof extensionMap)[];

export const getSourcePath = async (
	exportEntry: ExportEntry,
	source: string,
	dist: string,
): Promise<EntryPoint | void> => {
	const { outputPath } = exportEntry;
	const sourcePathUnresolved = source + outputPath.slice(dist.length);

	const distExtension = distExtensions.find(extension => outputPath.endsWith(extension));
	if (!distExtension) {
		console.warn(`Ignoring entry with unknown extension: ${stringify(outputPath)} (supported extensions: ${distExtensions.join(', ')})`);
		return;
	}

	const sourcePathWithoutExtension = sourcePathUnresolved.slice(0, -distExtension.length);
	const sourcePath = await tryExtensions(
		sourcePathWithoutExtension,
		extensionMap[distExtension],
	);

	if (sourcePath) {
		return {
			exportEntry,
			input: sourcePath.path,
			srcExtension: sourcePath.extension,
			distExtension,
		};
	}
	throw new Error(`Could not find matching source file for export path: ${stringify(outputPath)}; Expected: ${sourcePathWithoutExtension}[${extensionMap[distExtension].join('|')}]`);
};
