import type { Plugin } from 'rollup';
import { init, parse, type Exports } from 'cjs-module-lexer';
import MagicString from 'magic-string';

const isValidIdentifier = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u;
const isAsciiIdentifier = /^[a-z_$][\w$]*$/i;
const reservedWords = new Set([
	'break',
	'case',
	'catch',
	'class',
	'const',
	'continue',
	'debugger',
	'default',
	'delete',
	'do',
	'else',
	'enum',
	'export',
	'extends',
	'false',
	'finally',
	'for',
	'function',
	'if',
	'implements',
	'import',
	'in',
	'instanceof',
	'interface',
	'let',
	'new',
	'null',
	'package',
	'private',
	'protected',
	'public',
	'return',
	'static',
	'super',
	'switch',
	'this',
	'throw',
	'true',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',
	'yield',
]);

const cleanRollupId = (id: string): string => id.replace('\u0000', '').split('?')[0];

const quoteExportName = (name: string) => JSON.stringify(name)
	.replaceAll('\u2028', String.raw`\u2028`)
	.replaceAll('\u2029', String.raw`\u2029`);

// Older lexers stop at unsupported keys, so ASCII shorthand comes before Unicode shorthand.
// cjs-module-lexer 1.1.1 (Node 16.0) detects quoted identifier keys but stops at other quoted keys.
const getTier = (name: string) => {
	if (!isValidIdentifier.test(name)) {
		return 3;
	}
	if (reservedWords.has(name)) {
		return 2;
	}
	return isAsciiIdentifier.test(name) ? 0 : 1;
};

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
					const annotations = names
						.map(name => ({
							name,
							tier: getTier(name),
						}))
						.sort((a, b) => a.tier - b.tier)
						.map(({ name, tier }) => (tier < 2 ? name : `${quoteExportName(name)}:exports`));
					const magicString = new MagicString(code);
					magicString.append(`\n0&&(module.exports={${annotations.join(',')}});`);

					return {
						code: magicString.toString(),
						map: magicString.generateMap({ hires: true }).toString(),
					};
				}
			},
		},
	};
};
