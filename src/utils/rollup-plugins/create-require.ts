import type { Plugin } from 'rollup';
import replace from '@rollup/plugin-replace';
import inject from '@rollup/plugin-inject';

const virtualModuleName = 'pkgroll:create-require';

/**
 * Since rollup is bundled by rollup, it needs to add a run-time
 * suffix so that this doesn't get replaced.
 */
const isEsmVariableName = `IS_ESM${Math.random().toString(36).slice(2)}`;

/**
 * Plugin to seamlessly allow usage of `require`
 * across CJS and ESM modules.
 *
 * This is usually nor a problem for CJS outputs,
 * but for ESM outputs, it must be used via
 * createRequire.
 *
 * This plugin automatically injects it for ESM.
 */
export const createRequire = (): Plugin => ({
	...inject({
		require: virtualModuleName,
	}),

	name: 'create-require',

	resolveId: source => (
		(source === virtualModuleName)
			? source
			: null
	),

	load(id) {
		if (id !== virtualModuleName) {
			return null;
		}

		return `
		import { createRequire } from 'module';

		export default (
			${isEsmVariableName}
				? createRequire(import.meta.url)
				: require
		);
		`;
	},
});

export const isFormatEsm = (
	isEsm: boolean,
): Plugin => ({
	name: 'create-require-insert-format',

	// Pick out renderChunk because it's used as an output plugin
	renderChunk: replace({
		[isEsmVariableName]: isEsm,
	}).renderChunk!,
});
