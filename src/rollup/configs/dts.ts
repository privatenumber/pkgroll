import type { RollupOptions, Plugin } from 'rollup';
import type { TsConfigResult } from 'get-tsconfig';
import type { PackageJson } from 'type-fest';
import { importTrace } from 'rollup-plugin-import-trace';
import { nodeBuiltins } from '../plugins/node-builtins.ts';
import { resolveJsToTs } from '../plugins/resolve-js-to-ts.ts';
import { resolveTsconfigPaths } from '../plugins/resolve-tsconfig-paths.ts';
import { externalPkgImports } from '../plugins/external-pkg-imports.ts';
import { externalizeDependencies } from '../plugins/externalize-dependencies.ts';
import type { Options, Output } from '../types.ts';

// TypeScript 7 has no compiler API, so declaration bundling uses this TypeScript 6 enum value:
// https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/types.ts#L7619
const moduleKindPreserve = 200;

// TypeScript 7 has no compiler API, so declaration bundling uses this TypeScript 6 enum value:
// https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/types.ts#L7345
const moduleResolutionKindBundler = 100;

export const getDtsConfig = async (
	options: Options,
	packageJson: PackageJson,
	tsconfig: TsConfigResult | null,
) => {
	const [dts, ts] = await Promise.all([
		import('rollup-plugin-dts'),
		import('../../utils/local-typescript-loader.js'),
	]);
	const hasCompilerApi = typeof ts.default.createProgram === 'function';
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
			importTrace(),
			externalPkgImports(),
			nodeBuiltins(options),
			...(
				tsconfig
					? [resolveTsconfigPaths(tsconfig)]
					: []
			),
			externalizeDependencies(packageJson, {
				skipUnlistedWarnings: true,
				forTypes: true,
			}),
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
					module: hasCompilerApi ? ts.default.ModuleKind.Preserve : moduleKindPreserve,
					moduleResolution: hasCompilerApi
						? ts.default.ModuleResolutionKind.Bundler
						: moduleResolutionKindBundler,
				},
				tsconfig: tsconfig?.path,

				// Enable TypeScript declarationMap for .ts inputs when sourcemaps are enabled
				// This allows the output .d.ts.map to chain back to original .ts sources
				// Respects either --sourcemap flag or declarationMap in tsconfig
				sourcemap: Boolean(options.sourcemap || tsconfig?.config.compilerOptions?.declarationMap),
			}) as Plugin,
		],
		output: [] as unknown as Output,
	} satisfies RollupOptions;
};
