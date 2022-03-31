import type { Plugin } from 'rollup';

export function resolveTypescriptMjsCts(): Plugin {
	const isMjsCjs = /\.(?:mjs|cjs)$/;
	const isMtsCts = /\.(?:mts|cts)$/;

	return {
		name: 'resolve-typescript-mjs-cjs',
		resolveId(source, importer, options) {
			if (
				isMjsCjs.test(source)
				&& importer
				&& isMtsCts.test(importer)
			) {
				return this.resolve(
					source.replace(/js$/, 'ts'),
					importer,
					options,
				);
			}

			return null;
		},
	};
}
