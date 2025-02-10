import type { RollupOptions, Plugin } from 'rollup';
import type { TsConfigResult } from 'get-tsconfig';
import { externalizeNodeBuiltins } from '../plugins/externalize-node-builtins.js';
import { resolveTypescriptMjsCts } from '../plugins/resolve-typescript-mjs-cjs.js';
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
		input: [] as string[],
		preserveEntrySignatures: 'strict' as const,
		plugins: [
			externalizeNodeBuiltins(options),
			...(
				tsconfig
					? [resolveTsconfigPaths(tsconfig)]
					: []
			),
			resolveTypescriptMjsCts(),
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
