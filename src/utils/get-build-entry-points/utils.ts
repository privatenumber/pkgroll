import type { PackageType } from './types.ts';

export const getFileType = (
	filePath: string,
): PackageType | 'types' | 'json' | undefined => {
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
	if (filePath.endsWith('.json')) {
		return 'json';
	}
};

export const isPath = (filePath: string) => filePath[0] === '.';
