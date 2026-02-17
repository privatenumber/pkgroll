import type { RollupOptions } from 'rollup';
import type { TransformOptions } from 'esbuild';
import type { PackageJson } from 'type-fest';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import type { TsConfigResult } from 'get-tsconfig';
import { importTrace } from 'rollup-plugin-import-trace';
import type { AliasMap } from '../../types.ts';
import { esbuildTransform, esbuildMinify } from '../plugins/esbuild.ts';
import { nodeBuiltins } from '../plugins/node-builtins.ts';
import { patchBinary } from '../plugins/patch-binary.ts';
import { resolveJsToTs } from '../plugins/resolve-js-to-ts.ts';
import { resolveTsconfigPaths } from '../plugins/resolve-tsconfig-paths.ts';
import { stripHashbang } from '../plugins/strip-hashbang.ts';
import { esmInjectCreateRequire } from '../plugins/esm-inject-create-require.ts';
import { nativeModules } from '../plugins/native-modules.ts';
import { importAttributes } from '../plugins/import-attributes.ts';
import { externalPkgImports } from '../plugins/external-pkg-imports.ts';
import { resolveImplicitExternals } from '../plugins/resolve-implicit-externals.ts';
import { externalizeDependencies } from '../plugins/externalize-dependencies.ts';
import type { Options, Output } from '../types.ts';
import type { EntryPointValid } from '../../utils/get-build-entry-points/types.ts';
import { cjsAnnotateExports } from '../plugins/cjs-annotate-exports.ts';
import { licensePlugin } from '../plugins/license.ts';

export const getPkgConfig = (
	options: Options,
	packageJson: PackageJson,
	aliases: AliasMap,
	entryPoints: EntryPointValid[],
	tsconfig: TsConfigResult | null,
	distDirectory: string,
) => {
	const env = Object.fromEntries(
		options.env.map(({ key, value }) => [`process.env.${key}`, JSON.stringify(value)]),
	);
	const define = Object.fromEntries(
		options.define.map(({ key, value }) => [key, value]),
	);

	const esbuildConfig: TransformOptions = {
		target: options.target,
		sourcemap: options.sourcemap,
		tsconfigRaw: tsconfig?.config,
		define: {
			...env,
			...define,
		},
	};

	return {
		input: {} as Record<string, string>,
		preserveEntrySignatures: 'strict' as const,
		plugins: [
			importTrace(),
			nodeBuiltins(options),
			...(
				tsconfig
					? [resolveTsconfigPaths(tsconfig)]
					: []
			),
			alias({
				entries: aliases,
			}),
			externalPkgImports(),
			resolveImplicitExternals(),
			externalizeDependencies(packageJson),
			importAttributes(),
			resolveJsToTs(),
			nodeResolve({
				extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
				exportConditions: options.exportCondition,
			}),
			stripHashbang(),
			json(),
			esbuildTransform(esbuildConfig),
			cjsAnnotateExports(),
			commonjs({
				ignoreDynamicRequires: true,
				extensions: ['.js', '.ts', '.jsx', '.tsx'],
				transformMixedEsModules: true,
			}),
			dynamicImportVars({
				warnOnError: true,
			}),
			esmInjectCreateRequire(),
			nativeModules(distDirectory),
			...(
				options.minify
					? [esbuildMinify(esbuildConfig)]
					: []
			),
			patchBinary(entryPoints),
			...(
				options.license
					? [licensePlugin(options.license)]
					: []
			),
		],
		output: [] as unknown as Output,
	} satisfies RollupOptions;
};
