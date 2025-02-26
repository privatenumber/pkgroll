import MagicString from 'magic-string';
import { attachScopes, type AttachedScope } from 'rollup-pluginutils';
import { walk } from 'estree-walker';
import type { Plugin } from 'rollup';

export const esmInjectCreateRequire = (): Plugin => {
	const createRequire = 'import{createRequire as _pkgrollCR}from"node:module";const require=_pkgrollCR(import.meta.url);';

	return {
		name: 'esmInjectCreateRequire',
		renderChunk(code, _chunk, options) {
			if (
				options.format !== 'es'
				|| !/\brequire\b/.test(code)
			) {
				return null;
			}

			const ast = this.parse(code);
			let currentScope = attachScopes(ast, 'scope');
			let injectionNeeded = false;

			walk(ast, {
				enter(node, parent) {
					// Not all nodes have scopes
					if (node.scope) {
						currentScope = node.scope as AttachedScope;
					}

					if (node.type !== 'Identifier' || node.name !== 'require') {
						return;
					}

					if (
						parent?.type === 'Property'
						&& parent.key === node
						&& !parent.compute
					) {
						return;
					}

					// If the current scope (or its parents) does not contain 'require'
					if (!currentScope.contains('require')) {
						injectionNeeded = true;

						// No need to continue if one instance is found
						this.skip();
					}
				},
				leave: (node) => {
					if (node.scope) {
						currentScope = currentScope.parent!;
					}
				},
			});

			if (!injectionNeeded) {
				return null;
			}

			const magicString = new MagicString(code);
			magicString.prepend(createRequire);
			return {
				code: magicString.toString(),
				map: magicString.generateMap({ hires: true }),
			};
		},
	};
};
