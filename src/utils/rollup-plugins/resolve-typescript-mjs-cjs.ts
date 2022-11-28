import type { Plugin } from 'rollup';

export function resolveTypescriptMjsCts(): Plugin {
	const isJs = /\.(?:[mc]?js|jsx)$/;
	const isMtsCts = /\.(?:mts|cts)$/;

	return {
		name: 'resolve-typescript-mjs-cjs',
		resolveId(id, importer, options) {
			if (
				isJs.test(id)
				&& importer
				&& isMtsCts.test(importer)
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
}
