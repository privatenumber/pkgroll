import path from 'node:path';

export const normalizePath = (
	filePath: string,
	isDirectory?: boolean,
) => {
	// Ensure paths start with ./ for relative paths
	if (
		!path.isAbsolute(filePath) // Windows paths starts with C:\\
		&& !filePath.startsWith('.')
		&& !filePath.startsWith('/')
	) {
		filePath = `./${filePath}`;
	}

	if (isDirectory && !filePath.endsWith('/')) {
		filePath += '/';
	}

	return filePath;
};
