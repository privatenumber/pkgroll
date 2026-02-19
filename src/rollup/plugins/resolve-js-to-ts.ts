import type { Plugin } from 'rollup';
import {
	isBareSpecifier,
	isFromNodeModules,
} from '../../utils/import-specifier.ts';

/**
 * Plugin to resolve JS extensions to TypeScript equivalents
 *
 * Resolution order depends on context:
 * - Source code relative imports: Try TS extensions (prefer TypeScript source)
 * - Bare specifiers (package imports): Try .js first, fallback to TS extensions
 * - node_modules relative imports: Try .js first, fallback to TS extensions
 *
 * Bare specifiers must try .js first because the .js extension refers to
 * the actual compiled file in the package, not a TypeScript convention.
 * Transforming the specifier before exports map resolution can cause
 * wildcard patterns to capture the wrong value (e.g. .ts.js).
 *
 * Matches esbuild's rewrittenFileExtensions map:
 * https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1723-L1730
 */
export const resolveJsToTs = (): Plugin => {
	const jsExtension = /\.(?:[mc]?js|jsx)$/;

	// Matches esbuild's rewrittenFileExtensions
	const tsExtensions: Record<string, string[]> = {
		'.js': ['.ts', '.tsx'],
		'.jsx': ['.tsx', '.ts'],
		'.mjs': ['.mts'],
		'.cjs': ['.cts'],
	};

	return {
		name: 'resolve-js-to-ts',
		async resolveId(id, importer, options) {
			if (!importer || !jsExtension.test(id)) {
				return null;
			}

			const ext = id.match(jsExtension)![0];
			const rewrites = tsExtensions[ext];
			if (!rewrites) {
				return null;
			}

			const base = id.slice(0, -ext.length);
			const resolveOptions = { ...options, skipSelf: true };

			// For source code relative imports: try TS extensions in order
			if (!isBareSpecifier(id) && !isFromNodeModules(importer)) {
				for (const tsExt of rewrites) {
					const resolved = await this.resolve(
						base + tsExt,
						importer,
						resolveOptions,
					);
					if (resolved) {
						return resolved;
					}
				}
				return null;
			}

			// For bare specifiers and node_modules imports:
			// try .js first, only use TS extensions if .js doesn't resolve
			const jsResolved = await this.resolve(id, importer, resolveOptions);
			if (jsResolved) {
				return jsResolved;
			}

			for (const tsExt of rewrites) {
				try {
					const resolved = await this.resolve(
						base + tsExt,
						importer,
						resolveOptions,
					);
					if (resolved) {
						return resolved;
					}
				} catch {
					// externalizeDependencies throws for unresolvable devDep
					// bare specifiers — continue to try the next extension
				}
			}

			return null;
		},
	};
};
