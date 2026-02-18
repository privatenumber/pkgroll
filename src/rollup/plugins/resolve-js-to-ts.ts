import type { Plugin } from 'rollup';
import {
	isBareSpecifier,
	isFromNodeModules,
} from '../../utils/import-specifier.ts';

/**
 * Plugin to resolve JS extensions to TypeScript equivalents
 *
 * Resolution order depends on context:
 * - Source code relative imports: Try .ts before .js (prefer TypeScript source)
 * - Bare specifiers (package imports): Try .js first, fallback to .ts
 * - node_modules relative imports: Try .js first, fallback to .ts
 *
 * Bare specifiers must try .js first because the .js extension refers to
 * the actual compiled file in the package, not a TypeScript convention.
 * Transforming the specifier before exports map resolution can cause
 * wildcard patterns to capture the wrong value (e.g. .ts.js).
 *
 * This matches esbuild's behavior where .js → .ts rewriting is always
 * a last-resort fallback applied on the resolved path, not the specifier.
 *
 * See:
 * - esbuild resolver.go loadAsFile (lines 1816-1840): literal path first, .ts last
 * - esbuild resolver.go exports map (lines 2651-2670): .ts only if file missing
 * - esbuild CHANGELOG v0.18.0: prefer .js over .ts in node_modules
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
				// For source code relative imports: try .ts first
				// In TypeScript convention, ./file.js means ./file.ts
				if (!isBareSpecifier(id) && !isFromNodeModules(importer)) {
					const tsId = id.replace(/js(x?)$/, 'ts$1');

					// skipSelf prevents infinite recursion if .ts doesn't exist
					return this.resolve(tsId, importer, {
						...options,
						skipSelf: true,
					});
				}

				// For bare specifiers and node_modules imports:
				// try .js first, only use .ts if .js doesn't resolve
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

				// .js doesn't resolve, try .ts as fallback
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
