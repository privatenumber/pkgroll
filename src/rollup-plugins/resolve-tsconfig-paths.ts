import { createPathsMatcher, type TsConfigResult } from 'get-tsconfig';
import type { Plugin } from 'rollup';

const name = 'resolve-tsconfig-paths';

const isRelative = (filePath: string) => filePath[0] === '.';
const isAbsolute = (filePath: string) => filePath[0] === '/' || /^[\s\S]:/.test(filePath);

export const resolveTsconfigPaths = (
	tsconfig: TsConfigResult,
): Plugin => {
	const pathsMatcher = createPathsMatcher(tsconfig);
	if (!pathsMatcher) {
		return {
			name,
		};
	}

	return {
		name,
		async resolveId(id, importer, options) {
			if (
				!importer
				|| isRelative(id)
				|| isAbsolute(id)
				|| id.startsWith('\0')
			) {
				return null;
			}

			const possiblePaths = pathsMatcher(id);
			for (const tryPath of possiblePaths) {
				const resolved = await this.resolve(
					tryPath,
					importer,
					{
						skipSelf: true,
						...options,
					},
				);
				if (resolved) {
					return resolved;
				}
			}

			return null;
		},
	};
};
