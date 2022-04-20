import path from 'path';

const hasPathPrefixPattern = /^[/.]/;

export const normalizePath = (
	filePath: string,
	isDirectory?: boolean,
) => {
	if (
		!path.isAbsolute(filePath) // Windows paths starts with C:\\
		&& !hasPathPrefixPattern.test(filePath)
	) {
		filePath = `./${filePath}`;
	}

	if (isDirectory && !filePath.endsWith('/')) {
		filePath += '/';
	}

	return filePath;
};
