import path from 'node:path';
import { slash } from './normalize-path.js';

/**
 * Parse import specifier into package name and subpath
 * Examples:
 * - 'foo' → ['foo', undefined]
 * - 'foo/bar' → ['foo', 'bar']
 * - '@org/pkg' → ['@org/pkg', undefined]
 * - '@org/pkg/sub' → ['@org/pkg', 'sub']
 */
export const parseSpecifier = (
	specifier: string,
): [packageName: string, subpath: string | undefined] => {
	const firstSlash = specifier.indexOf('/');

	if (firstSlash === -1) {
		return [specifier, undefined];
	}

	if (specifier[0] === '@') {
		// Scoped package: @org/package[/subpath]
		const secondSlash = specifier.indexOf('/', firstSlash + 1);
		if (secondSlash === -1) {
			return [specifier, undefined];
		}
		return [specifier.slice(0, secondSlash), specifier.slice(secondSlash + 1)];
	}

	// Regular package: package[/subpath]
	return [specifier.slice(0, firstSlash), specifier.slice(firstSlash + 1)];
};

/**
 * Check if a specifier is a bare specifier (not relative or absolute)
 */
export const isBareSpecifier = (id: string): boolean => {
	const firstCharacter = id[0];
	return !(
		firstCharacter === '.'
		|| firstCharacter === '/'
		|| firstCharacter === '#'
		|| path.isAbsolute(id)
	);
};

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
