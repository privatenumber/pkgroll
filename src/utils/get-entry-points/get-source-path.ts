import path from 'node:path/posix';
import { fsExists } from '../fs-exists.js';
import type { SrcDistPair } from '../../types.js';
import type { BuildOutput, EntryPoint } from './types.js';

const tryExtensions = async (
	pathWithoutExtension: string,
	extensions: readonly string[],
) => {
	for (const srcExtension of extensions) {
		const sourcePath = pathWithoutExtension + srcExtension;
		if (await fsExists(sourcePath)) {
			return {
				srcExtension,
				sourcePath,
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
	exportEntry: BuildOutput,
	srcdist: SrcDistPair,
): Promise<EntryPoint> => {
	const { outputPath } = exportEntry;
	const distExtension = distExtensions.find(extension => outputPath.endsWith(extension));
	if (!distExtension) {
		return {
			error: `Unsupported extension (must be ${distExtensions.join('|')})`,
			exportEntry,
		};
	}

	const noExtension = outputPath.slice(srcdist.dist.length, -distExtension.length);
	const foundSourceFile = await tryExtensions(
		path.join(srcdist.srcResolved, noExtension),
		extensionMap[distExtension],
	);

	if (foundSourceFile) {
		return {
			exportEntry,
			distExtension,
			srcdist,
			...foundSourceFile,
		};
	}

	return {
		error: `Source file not found: ${path.join(srcdist.src, noExtension)}(${extensionMap[distExtension].join('|')})`,
		exportEntry,
	};
};
