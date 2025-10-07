import fs from 'node:fs/promises';
import path from 'node:path/posix';

const safeReaddir = async (searchPath: string) => {
	try {
		return await fs.readdir(searchPath, { withFileTypes: true });
	} catch (error) {
		// Directory doesn't exist - can happen when package.json exports reference
		// source directories that don't exist yet (e.g., optional wildcard patterns)
		const { code } = (error as NodeJS.ErrnoException);
		if (code === 'ENOENT') {
			return [];
		}
		throw error;
	}
};

const getDirectoryFilesRecursive = async (
	searchPath: string,
	basePath: string,
): Promise<string[]> => {
	const entries = await safeReaddir(searchPath);
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(searchPath, entry.name);

			if (entry.isDirectory()) {
				return getDirectoryFilesRecursive(fullPath, basePath);
			}
			if (entry.isFile()) {
				return path.relative(basePath, fullPath);
			}
			return [];
		}),
	);
	return files.flat();
};

// Cache directory scans to avoid scanning same directory multiple times
// Key: search path, Value: promise resolving to file list
const directoryCache = new Map<string, Promise<string[]>>();

/**
 * Recursively list all file paths in a directory (with caching)
 * @param searchPath - Directory to search in (expected to use forward slashes)
 * @returns Array of relative file paths with forward slashes (e.g., ["foo.js", "bar/baz.js"])
 */
export const getDirectoryFiles = async (
	searchPath: string,
): Promise<string[]> => {
	let filesPromise = directoryCache.get(searchPath);
	if (!filesPromise) {
		filesPromise = getDirectoryFilesRecursive(searchPath, searchPath);
		directoryCache.set(searchPath, filesPromise);
	}
	return filesPromise;
};
