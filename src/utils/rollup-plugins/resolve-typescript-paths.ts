import { dirname, resolve } from 'path';
import { createPathsMatcher } from 'get-tsconfig';
import type { Plugin } from 'rollup';
import type { TsConfigResult } from 'get-tsconfig';

const name = 'resolve-typescript-paths'

const isRelative = (modulePath: string) => modulePath.charAt(0) === '.'
const isAbsolute = (modulePath: string) => modulePath.charAt(0) === '/' || /^[\W\w]\:/.test(modulePath);
const isImports = (modulePath: string) => modulePath.charAt(0) === '#';
const isBare = (modulePath: string) => /^[\W\w]/.test(modulePath);

const escapeRegex = (str: string) => {
	return str.replace(/[$^]/g, '\\$&');
};

const isMapped = (paths: Record<string, string[]>, id: string) => Object
	.keys(paths)
	.some((path) =>
		new RegExp('^' + escapeRegex(path.replace('*', '.+')) + '$').test(
			id,
		),
	);

export const resolveTypescriptPaths = (
	tsconfig: TsConfigResult | null,
): Plugin => {
	if (!tsconfig?.config.compilerOptions) {
		return {
			name,
			resolveId: () => null
		}
	}

	const { baseUrl, paths } = tsconfig.config.compilerOptions;
	const mapper = createPathsMatcher(tsconfig);

	return {
		name,
		async resolveId(id, importer, options) {

			if (!importer) return null;

			if (
				isRelative(id) ||
				isAbsolute(id) ||
				isImports(id) ||
				id.startsWith('\0')
			) return null;

			if (baseUrl && isBare(id)) {
				const baseUrlPath = resolve(dirname(tsconfig.path), baseUrl);
				const importee = resolve(baseUrlPath, id);
				const resolved = await this.resolve(
					importee,
					importer,
					Object.assign({ skipSelf: true }, options),
				);

				return resolved;
			}

			if (paths && mapper && isMapped(paths, id)) {
				const resolved = await Promise.all(
					mapper(id)
					.map(importee => this.resolve(
						importee,
						importer,
						Object.assign({ skipSelf: true }, options),
					))
				);

				for (const result of resolved) {
					if (result) return result;
				}

				return null;
			}

			return null;
		},
	};
};
