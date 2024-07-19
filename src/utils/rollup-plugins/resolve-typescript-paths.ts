import path from 'path';
import { createPathsMatcher } from 'get-tsconfig';
import type { Plugin } from 'rollup';
import type { TsConfigResult } from 'get-tsconfig';

const name = 'resolve-typescript-paths';

const isRelative = (modulePath: string) => modulePath.charAt(0) === '.';
const isAbsolute = (modulePath: string) => modulePath.charAt(0) === '/' || /^[\s\S]:/.test(modulePath);
const isImports = (modulePath: string) => modulePath.charAt(0) === '#';
const isBare = (modulePath: string) => /^[\s\S]/.test(modulePath);

const escapeRegex = (string_: string) => string_.replaceAll(/[$^]/g, String.raw`\$&`);

const isMapped = (
	paths: Record<string, string[]>,
	id: string,
) => Object
	.keys(paths)
	.some(
		filePath => new RegExp(`^${escapeRegex(filePath.replace('*', '.+'))}$`).test(id),
	);

export const resolveTypescriptPaths = (
	tsconfig: TsConfigResult | null,
): Plugin => {
	if (!tsconfig?.config.compilerOptions) {
		return {
			name,
			resolveId: () => null,
		};
	}

	const { baseUrl, paths } = tsconfig.config.compilerOptions;
	const mapper = createPathsMatcher(tsconfig);

	return {
		name,
		async resolveId(id, importer, options) {
			if (!importer) { return null; }

			if (
				isRelative(id)
				|| isAbsolute(id)
				|| isImports(id)
				|| id.startsWith('\0')
			) { return null; }

			if (baseUrl && isBare(id)) {
				const baseUrlPath = path.resolve(path.dirname(tsconfig.path), baseUrl);
				const importee = path.resolve(baseUrlPath, id);
				const resolved = await this.resolve(
					importee,
					importer,
					{
						skipSelf: true,
						...options,
					},
				);

				return resolved;
			}

			if (paths && mapper && isMapped(paths, id)) {
				const resolved = await Promise.all(
					mapper(id)
						.map(importee => this.resolve(
							importee,
							importer,
							{
								skipSelf: true,
								...options,
							},
						)),
				);

				for (const result of resolved) {
					if (result) { return result; }
				}

				return null;
			}

			return null;
		},
	};
};
