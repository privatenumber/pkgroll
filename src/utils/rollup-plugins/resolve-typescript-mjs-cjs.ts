import type { Plugin } from 'rollup';

export const resolveTypescriptMjsCts = (): Plugin => {
	const isJs = /\.(?:[mc]?js|jsx)$/;

	return {
		name: 'resolve-typescript-mjs-cjs',
		resolveId(id, importer, options) {
			if (
				isJs.test(id)
				&& importer
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
