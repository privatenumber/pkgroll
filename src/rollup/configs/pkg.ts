import type { RollupOptions } from 'rollup';
import type { TransformOptions } from 'esbuild';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import type { TsConfigResult } from 'get-tsconfig';
import type { AliasMap } from '../../types.js';
import { esbuildTransform, esbuildMinify } from '../plugins/esbuild.js';
import { nodeBuiltins } from '../plugins/node-builtins.js';
import { patchBinary } from '../plugins/patch-binary.js';
import { resolveJsToTs } from '../plugins/resolve-js-to-ts.js';
import { resolveTsconfigPaths } from '../plugins/resolve-tsconfig-paths.js';
import { stripHashbang } from '../plugins/strip-hashbang.js';
import { esmInjectCreateRequire } from '../plugins/esm-inject-create-require.js';
import { nativeModules } from '../plugins/native-modules.js';
import type { Options, Output } from '../types.js';
import type { EntryPointValid } from '../../utils/get-entry-points/types.js';
import { cjsAnnotateExports } from '../plugins/cjs-annotate-exports.js';

export const getPkgConfig = (
	options: Options,
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
			nodeBuiltins(options),
			...(
				tsconfig
					? [resolveTsconfigPaths(tsconfig)]
					: []
			),
			resolveJsToTs(),
			alias({
				entries: aliases,
			}),
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
		],
		output: [] as unknown as Output,
		external: [] as (string | RegExp)[],
	} satisfies RollupOptions;
};
