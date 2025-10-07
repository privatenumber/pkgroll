import type { PackageType } from './types.js';

export const getFileType = (
	filePath: string,
): PackageType | 'types' | undefined => {
	if (filePath.endsWith('.mjs')) {
		return 'module';
	}
	if (filePath.endsWith('.cjs')) {
		return 'commonjs';
	}
	if (
		filePath.endsWith('.d.ts')
        || filePath.endsWith('.d.cts')
        || filePath.endsWith('.d.mts')
	) {
		return 'types';
	}
};

export const isPath = (filePath: string) => filePath[0] === '.';
