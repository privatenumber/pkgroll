import type { Plugin } from 'rollup';

export function resolveTypescriptMjsCts(): Plugin {
	const isJs = /\.(?:[mc]?js|jsx)$/;
	const isMtsCts = /\.(?:mts|cts)$/;

	return {
		name: 'resolve-typescript-mjs-cjs',
		async resolveId(id, importer, options) {
			if (
				isJs.test(id)
				&& importer
				&& isMtsCts.test(importer)
			) {
				return this.resolve(
					id.replace(/jsx?$/, 'ts'),
					importer,
					options,
				);
			}

			return null;
		},
	};
}
