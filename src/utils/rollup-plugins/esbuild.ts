import type { Plugin, InternalModuleFormat } from 'rollup';
import { createFilter } from '@rollup/pluginutils';
import { transform, type TransformOptions, type Format } from 'esbuild';
import { tsconfig } from '../tsconfig';

export function esbuildTransform(
	options?: TransformOptions,
): Plugin {
	const filter = createFilter(
		/\.([cm]?ts|[jt]sx)$/,
	);

	return {
		name: 'esbuild-transform',
		async transform(code, id) {
			if (!filter(id)) {
				return null;
			}

			const result = await transform(code, {
				...options,

				loader: 'default',

				// https://github.com/evanw/esbuild/issues/1932#issuecomment-1013380565
				sourcefile: id.replace(/\.[cm]ts/, '.ts'),

				tsconfigRaw: tsconfig?.config,
			});

			return {
				code: result.code,
				map: result.map || null,
			};
		},
	};
}

const getEsbuildFormat = (rollupFormat: InternalModuleFormat): Format | undefined => {
	if (rollupFormat === 'es') {
		return 'esm';
	}

	if (rollupFormat === 'cjs' || rollupFormat === 'iife') {
		return rollupFormat;
	}
};

export function esbuildMinify(
	options?: TransformOptions,
): Plugin {
	return {
		name: 'esbuild-minify',
		async renderChunk(code, _, rollupOptions) {
			const result = await transform(code, {
				/**
				 * `target` is used to prevent new minification syntax
				 * from being used.
				 *
				 * https://github.com/evanw/esbuild/releases/tag/v0.14.25#:~:text=Minification%20now%20takes%20advantage%20of%20the%20%3F.%20operator
				 */
				...options,

				// https://github.com/egoist/rollup-plugin-esbuild/issues/317
				format: getEsbuildFormat(rollupOptions.format),

				minify: true,
			});

			return {
				code: result.code,
				map: result.map || null,
			};
		},
	};
}
