import path from 'node:path';

// Convert Windows backslashes to forward slashes
export const slash = (p: string) => p.replaceAll('\\', '/');

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
