import path from 'node:path';
import { slash } from './normalize-path.js';

/**
 * Check if a file path is from node_modules
 *
 * @param filePath - Absolute file path to check
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns true if path contains node_modules directory
 */
export const isFromNodeModules = (
	filePath: string,
	cwd = process.cwd(),
): boolean => {
	const relativePath = slash(path.relative(cwd, filePath));
	const pathSegments = relativePath.split('/');
	return pathSegments.includes('node_modules');
};
