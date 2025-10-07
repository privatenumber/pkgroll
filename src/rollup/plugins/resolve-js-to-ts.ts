import type { Plugin } from 'rollup';

/**
 * Plugin to resolve JS extensions to TypeScript equivalents
 * .js -> .ts
 * .jsx -> .tsx
 * .mjs -> .mts
 * .cjs -> .cts
 */
export const resolveJsToTs = (): Plugin => {
	const isJs = /\.(?:[mc]?js|jsx)$/;

	return {
		name: 'resolve-js-to-ts',
		resolveId(id, importer, options) {
			if (
				importer
				&& isJs.test(id)
			) {
				return this.resolve(
					id.replace(/js(x?)$/, 'ts$1'),
					importer,
					options,
				);
			}

			return null;
		},
	};
};
