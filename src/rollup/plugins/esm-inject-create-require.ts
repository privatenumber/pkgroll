import MagicString from 'magic-string';
import { attachScopes, type AttachedScope } from 'rollup-pluginutils';
import { walk } from 'estree-walker';
import type { Plugin } from 'rollup';

export const esmInjectCreateRequire = (): Plugin => {
	const baseBinding = '_pkgrollCR';

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
					if (
						node.type === 'ImportDeclaration'
						|| (node.type === 'ExportNamedDeclaration' && node.source)
						|| node.type === 'ExportAllDeclaration'
					) {
						this.skip();
						return;
					}

					// Not all nodes have scopes
					if (node.scope) {
						currentScope = node.scope as AttachedScope;
					}

					if (node.type !== 'Identifier' || node.name !== 'require') {
						return;
					}

					if (parent?.type === 'ExportSpecifier' && parent.exported === node) {
						return;
					}

					// Ignore non-computed property names.
					if (
						(parent?.type === 'Property' || parent?.type === 'MethodDefinition' || parent?.type === 'PropertyDefinition')
						&& parent.key === node
						&& !parent.computed
					) {
						return;
					}

					if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) {
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

			let binding = baseBinding;
			let suffix = 0;
			while (code.includes(binding)) {
				suffix += 1;
				binding = `${baseBinding}${suffix}`;
			}

			const magicString = new MagicString(code);
			magicString.prepend(`import{createRequire as ${binding}}from"node:module";const require=${binding}(import.meta.url);`);
			return {
				code: magicString.toString(),
				map: magicString.generateMap({ hires: true }).toString(),
			};
		},
	};
};
