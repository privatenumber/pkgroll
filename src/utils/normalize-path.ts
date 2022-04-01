const hasPathPrefixPattern = /^[/.]/;

export const normalizePath = (
	filePath: string,
	isDirectory?: boolean,
) => {
	if (!hasPathPrefixPattern.test(filePath)) {
		filePath = `./${filePath}`;
	}

	if (isDirectory && !filePath.endsWith('/')) {
		filePath += '/';
	}

	return filePath;
};
