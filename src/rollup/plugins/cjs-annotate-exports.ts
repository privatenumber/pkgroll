import type { Plugin } from 'rollup';
import { init, parse, type Exports } from 'cjs-module-lexer';
import MagicString from 'magic-string';

const cleanRollupId = (id: string): string => id.replace('\u0000', '').split('?')[0];

const safeParse = (code: string) => {
	try {
		return parse(code);
	} catch {
		return {
			exports: [],
			reexports: [],
		};
	}
};

export const cjsAnnotateExports = (): Plugin => {
	const moduleInfo = new Map<string, Exports>();

	const getFinalExports = (
		moduleId: string,
		visited = new Set<string>(),
	) => {
		const cleanId = cleanRollupId(moduleId);
		if (visited.has(cleanId)) { return []; }
		visited.add(cleanId);

		const info = moduleInfo.get(cleanId);
		if (!info) { return []; }

		const allExports = [...info.exports];
		for (const reexportId of info.reexports) {
			allExports.push(...getFinalExports(reexportId, visited));
		}
		return allExports;
	};

	return {
		name: 'cjs-annotate-exports',

		buildStart: async () => {
			await init();
			moduleInfo.clear();
		},

		async transform(code, id) {
			const cleanId = cleanRollupId(id);
			if (!/\.c?js$/.test(cleanId)) {
				return;
			}

			if (!code.includes('exports')) {
				return;
			}

			const { exports, reexports } = safeParse(code);
			if (exports.length === 0 && reexports.length === 0) {
				return;
			}

			const resolvedReexports = await Promise.all(
				reexports.map(async (reexportPath) => {
					const resolved = await this.resolve(reexportPath, id);
					return resolved ? cleanRollupId(resolved.id) : '';
				}),
			);

			const validReexports = resolvedReexports.filter(Boolean);

			moduleInfo.set(cleanId, {
				exports,
				reexports: validReexports,
			});
		},

		renderChunk: {
			order: 'post',
			handler(code, chunk, options) {
				if (options.format !== 'cjs' || !chunk.isEntry || !chunk.facadeModuleId) {
					return null;
				}

				const cleanFacadeId = cleanRollupId(chunk.facadeModuleId);
				const names = [...new Set(getFinalExports(cleanFacadeId))];

				if (names.length > 0) {
					const magicString = new MagicString(code);
					magicString.append(`\n0&&(module.exports={${names.join(',')}});`);

					return {
						code: magicString.toString(),
						map: magicString.generateMap({ hires: true }),
					};
				}
			},
		},
	};
};
