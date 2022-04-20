import path from 'path';

const hasPathPrefixPattern = /^[/.]/;

export const normalizePath = (
	filePath: string,
	isDirectory?: boolean,
) => {
	
	if (
		!path.isAbsolute(filePath)
		&& !hasPathPrefixPattern.test(filePath)
	) {
		filePath = `./${filePath}`;
	}

	if (isDirectory && !filePath.endsWith('/')) {
		filePath += '/';
	}

	return filePath;
};
