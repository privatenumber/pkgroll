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
	'.d.ts': ['.d.ts', '.d.mts', '.d.cts', '.ts', '.tsx', '.mts', '.cts'],
	'.d.mts': ['.d.mts', '.d.ts', '.d.cts', '.ts', '.tsx', '.mts', '.cts'],
	'.d.cts': ['.d.cts', '.d.ts', '.d.mts', '.ts', '.tsx', '.mts', '.cts'],
	'.js': ['.js', '.ts', '.tsx', '.mts', '.cts'],
	'.mjs': ['.mjs', '.js', '.cjs', '.mts', '.cts', '.ts', '.tsx'],
	'.cjs': ['.cjs', '.js', '.mjs', '.mts', '.cts', '.ts', '.tsx'],
} as const;

const distExtensions = Object.keys(extensionMap) as (keyof typeof extensionMap)[];

export const getSourcePath = async (
	{ outputPath }: ExportEntry,
	source: string,
	dist: string,
) => {
	const sourcePathUnresolved = source + outputPath.slice(dist.length);

	const distExtension = distExtensions.find(extension => outputPath.endsWith(extension));
	if (distExtension) {
		const sourcePathWithoutExtension = sourcePathUnresolved.slice(0, -distExtension.length);
		const sourcePath = await tryExtensions(
			sourcePathWithoutExtension,
			extensionMap[distExtension],
		);

		if (sourcePath) {
			return {
				input: sourcePath.path,
				srcExtension: sourcePath.extension,
				distExtension,
			};
		}
		throw new Error(`Could not find matching source file for export path: ${stringify(outputPath)}; Expected: ${sourcePathWithoutExtension}[${extensionMap[distExtension].join('|')}]`);
	}

	throw new Error(`Package.json output path contains invalid extension: ${stringify(outputPath)}; Expected: ${distExtensions.join(', ')}`);
};
