import path from 'node:path';
import type { PackageJson } from 'type-fest';
import type { AliasMap } from '../../types.js';

export const getAliases = (
	{ imports }: PackageJson,
	baseDirectory: string,
): AliasMap => {
	const aliases: AliasMap = {};

	if (imports) {
		for (const alias in imports) {
			if (alias.startsWith('#')) {
				continue;
			}

			const subpath = imports[alias as keyof PackageJson.Imports];
			if (typeof subpath !== 'string') {
				continue;
			}

			aliases[alias] = path.join(baseDirectory, subpath);
		}
	}

	return aliases;
};
