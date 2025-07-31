import type { RollupOptions, Plugin } from 'rollup';
import type { TsConfigResult } from 'get-tsconfig';
import { nodeBuiltins } from '../plugins/node-builtins.js';
import { resolveJsToTs } from '../plugins/resolve-js-to-ts.js';
import { resolveTsconfigPaths } from '../plugins/resolve-tsconfig-paths.js';
import type { Options, Output } from '../types.js';

export const getDtsConfig = async (
	options: Options,
	tsconfig: TsConfigResult | null,
) => {
	const [dts, ts] = await Promise.all([
		import('rollup-plugin-dts'),
		import('../../utils/local-typescript-loader.js'),
	]);
	return {

		/**
		 * Input is an object instead of array because rollup-plugin-dts has a bug
		 * where it normalizes input paths but doesn't account for duplicate file names
		 * across nested directories:
		 * https://github.com/Swatinem/rollup-plugin-dts/blob/32ba006c6148778d90422095fdf1f4c5b8a91ef3/src/index.ts#L99-L107
		 */
		input: {} as Record<string, string>,
		preserveEntrySignatures: 'strict' as const,
		plugins: [
			nodeBuiltins(options),
			...(
				tsconfig
					? [resolveTsconfigPaths(tsconfig)]
					: []
			),
			resolveJsToTs(),
			dts.default({
				respectExternal: true,

				/**
                 * https://github.com/privatenumber/pkgroll/pull/54
                 *
                 * I think this is necessary because TypeScript's composite requires
                 * that all files are passed in via `include`. However, it seems that
                 * rollup-plugin-dts doesn't read or relay the `include` option in tsconfig.
                 *
                 * For now, simply disabling composite does the trick since it doesn't seem
                 * necessary for dts bundling.
                 *
                 * One concern here is that this overwrites the compilerOptions. According to
                 * the rollup-plugin-dts docs, it reads from baseUrl and paths.
                 */
				compilerOptions: {
					composite: false,
					preserveSymlinks: false,
					module: ts.default.ModuleKind.Preserve,
					moduleResolution: ts.default.ModuleResolutionKind.Bundler,
				},
				tsconfig: tsconfig?.path,
			}) as Plugin,
		],
		output: [] as unknown as Output,
		external: [] as (string | RegExp)[],
	} satisfies RollupOptions;
};
