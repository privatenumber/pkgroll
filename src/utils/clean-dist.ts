import fs from 'node:fs';
import path from 'node:path';
import type { SrcDistPairInput } from '../types.ts';

const getIdentity = (filePath: string): string | undefined => {
	try {
		const { dev, ino } = fs.statSync(filePath, { bigint: true });
		return `${dev}:${ino}`;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return undefined;
		}
		throw error;
	}
};

const ancestorIdentities = (directory: string) => {
	const identities = new Set<string>();
	while (true) {
		const identity = getIdentity(directory);
		if (identity !== undefined) {
			identities.add(identity);
		}
		const parent = path.dirname(directory);
		if (parent === directory) {
			return identities;
		}
		directory = parent;
	}
};

export const assertSafeCleanDestinations = (srcDistPairs: SrcDistPairInput[], cwd: string) => {
	const protectedDirectories = [
		{
			path: cwd,
			description: 'the working directory',
		},
		...srcDistPairs.flatMap(({ src, srcResolved }) => {
			const description = `the source directory ${JSON.stringify(src)}`;
			return [srcResolved, path.resolve(cwd, src)].map(sourcePath => ({
				path: sourcePath,
				description,
			}));
		}),
	].map(directory => ({
		identities: ancestorIdentities(directory.path),
		description: directory.description,
	}));
	for (const { dist } of srcDistPairs) {
		const identity = getIdentity(dist);
		if (identity === undefined) {
			continue;
		}
		for (const directory of protectedDirectories) {
			if (directory.identities.has(identity)) {
				throw new Error(`--clean-dist refused to delete ${JSON.stringify(dist)} because it contains ${directory.description}`);
			}
		}
	}
};

export const cleanDist = async (directoryPath: string) => {
	await fs.promises.rm(directoryPath, {
		recursive: true,
		force: true,
	});
};
