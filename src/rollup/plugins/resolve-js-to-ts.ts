import type { Plugin } from 'rollup';
import { isFromNodeModules } from '../../utils/import-specifier.ts';

/**
 * Plugin to resolve JS extensions to TypeScript equivalents
 *
 * Resolution order depends on location:
 * - Source code: Try .ts before .js (prefer TypeScript source)
 * - node_modules: Try .js before .ts (prefer compiled output)
 *
 * This matches esbuild's behavior (v0.20.0+) where .js is preferred over .ts
 * in node_modules to avoid issues with:
 * - Missing or unpublished tsconfig.json files
 * - Packages that accidentally ship both .js and .ts files
 *
 * See: https://github.com/evanw/esbuild/releases/tag/v0.20.0
 */
export const resolveJsToTs = (): Plugin => {
	const isJs = /\.(?:[mc]?js|jsx)$/;

	return {
		name: 'resolve-js-to-ts',
		async resolveId(id, importer, options) {
			if (
				importer
				&& isJs.test(id)
			) {
				// For source code: try .ts first (default behavior)
				if (!isFromNodeModules(importer)) {
					const tsId = id.replace(/js(x?)$/, 'ts$1');

					// skipSelf prevents infinite recursion if .ts doesn't exist
					return this.resolve(tsId, importer, {
						...options,
						skipSelf: true,
					});
				}

				// For node_modules: try .js first, only use .ts if .js doesn't exist
				// First check if .js exists
				const jsResolved = await this.resolve(
					id,
					importer,
					{
						...options,
						skipSelf: true,
					},
				);

				if (jsResolved) {
					return jsResolved;
				}

				// .js doesn't exist, try .ts
				const tsId = id.replace(/js(x?)$/, 'ts$1');
				const tsResolved = await this.resolve(
					tsId,
					importer,
					{
						...options,
						skipSelf: true,
					},
				);

				if (tsResolved) {
					return tsResolved;
				}
			}

			return null;
		},
	};
};
