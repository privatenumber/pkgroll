import fs from 'node:fs/promises';
import path from 'node:path/posix';
import { fsExists } from '../fs-exists.ts';
import type { SrcDistPairInput } from '../../types.ts';
import type { BuildOutput, EntryPoint } from './types.ts';

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

const hashbangPattern = /^#!.*/;

/**
 * Read the entry source's hashbang so it can travel on the BinaryOutput
 * record. Letting the data live with the entry point (rather than getting
 * scraped opportunistically out of the Rollup transform pass) means
 * patch-binary has a typed, single source of truth.
 */
const readHashbang = async (
	sourcePath: string,
): Promise<string | undefined> => {
	const source = await fs.readFile(sourcePath, 'utf8');
	return hashbangPattern.exec(source)?.[0];
};

const extensionMap = {
	'.d.ts': ['.d.ts', '.d.mts', '.d.cts', '.ts', '.tsx', '.mts', '.cts'],
	'.d.mts': ['.d.mts', '.d.ts', '.d.cts', '.ts', '.tsx', '.mts', '.cts'],
	'.d.cts': ['.d.cts', '.d.ts', '.d.mts', '.ts', '.tsx', '.mts', '.cts'],
	'.js': ['.js', '.ts', '.tsx', '.mts', '.cts'],
	'.mjs': ['.mjs', '.js', '.cjs', '.mts', '.cts', '.ts', '.tsx'],
	'.cjs': ['.cjs', '.js', '.mjs', '.mts', '.cts', '.ts', '.tsx'],
	'.json': ['.json'],
} as const;

const distExtensions = Object.keys(extensionMap) as (keyof typeof extensionMap)[];

export const getSourcePath = async (
	exportEntry: BuildOutput,
	srcdist: SrcDistPairInput,
): Promise<EntryPoint> => {
	const { outputPath } = exportEntry;
	const distExtension = distExtensions.find(extension => outputPath.endsWith(extension));
	if (!distExtension) {
		return {
			error: `Unsupported extension (must be ${distExtensions.join('|')})`,
			exportEntry,
		};
	}

	if (distExtension === '.json') {
		if (exportEntry.type === 'binary') {
			return {
				error: 'JSON is not supported for "bin" entry points',
				exportEntry,
			};
		}
		if (exportEntry.format !== 'json') {
			return {
				error: `JSON is not supported for "${exportEntry.format}" entry points`,
				exportEntry,
			};
		}
	}

	const noExtension = outputPath.slice(srcdist.dist.length, -distExtension.length);
	const foundSourceFile = await tryExtensions(
		path.join(srcdist.srcResolved, noExtension),
		extensionMap[distExtension],
	);

	if (foundSourceFile) {
		if (exportEntry.type === 'binary') {
			exportEntry.hashbang = await readHashbang(foundSourceFile.sourcePath);
		}

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
