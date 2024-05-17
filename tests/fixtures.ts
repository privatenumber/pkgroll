import outdent from 'outdent';

export const packageFixture = {
	'tsconfig.json': JSON.stringify({
		compilerOptions: {
			jsx: 'react',
			moduleResolution: 'node',
		},
	}),

	src: {
		nested: {
			'index.ts': outdent`
			console.log('nested entry point');

			export function sayHello(name: string) {
			  return name;
			}
			`,
			'utils.ts': outdent`
			export { writeFileSync } from 'fs';
			export { readFileSync } from 'node:fs';

			export function sayGoodbye(name: string) {
				console.log('Goodbye', name);
			}
			`,
		},

		'cjs.cjs': outdent`
		#! /usr/bin/env node

		console.log('side effect');

		module.exports = function sayHello(name) {
			console.log('Hello', name);
		};
		`,

		'component.tsx': outdent`
		export const Component = () => (<div>Hello World</div>);
		`,

		'conditional-require.js': outdent`
		if (process.env.NODE_ENV === 'production') {
			console.log('production');
			require('./cjs.cjs');
		} else {
			console.log('development');
		}

		console.log(1);
		`,

		'cts.cts': outdent`
		export function sayHello(name: string) {
			console.log('Hello', name);
		}
		`,

		'dependency-exports-import.js': outdent`
		import esm from 'dependency-exports-dual';

		console.log(esm);
		`,

		'dependency-exports-require.js': outdent`
		console.log(require('dependency-exports-dual'));
		`,

		'dependency-external.js': outdent`
		/**
		 * Should be imported with a package.json
		 * with "@org/name" in the "dependency" field
		 */
		import someValue from '@org/name/path';

		console.log(someValue);
		`,

		'dependency-imports-map.js': outdent`
		import value from 'dependency-imports-map';

		console.log(value);
		`,

		'dts.d.ts': outdent`
		import type { SomeType } from './types';

		declare const value: SomeType;

		export default value;
		`,

		'index.js': outdent`
		#! /usr/bin/env node

		import value from './value.js';
		import { Component } from './component.tsx';
		import { sayHello } from './utils.js';
		import { sayHello as sayHelloMjs } from './mjs.mjs';
		import { sayHello as sayHelloMts } from './mts.mts';
		import { sayHello as sayHelloCjs } from './cjs.cjs';
		import { sayHello as sayHelloCts } from './cts.cts';

		console.log(
			Component,
			sayHello,
			sayHelloMjs,
			sayHelloMts,
			sayHelloCjs,
			sayHelloCts,
		);

		export default value * 2;
		`,

		'mjs.mjs': outdent`
		export function sayHello(name) {
			console.log('Hello', name);
		};
		`,

		'mts.mts': outdent`
		export { sayGoodbye } from './mts2.mjs';
		export { foo } from './target.js';
		export { sayHello as sayHello2 } from './mjs.mjs';

		export function sayHello(name: string) {
			console.log('Hello', name);
		}
		`,

		'mts2.mts': outdent`
		export function sayGoodbye(name: string) {
			console.log('Goodbye', name);
		}
		`,

		'require.ts': outdent`
		console.log(require('fs'));

		export const a = 1;
		`,

		'target.ts': outdent`
		console.log(2 ** 3);

		/**
		 * Expect minification to apply ?. optional chaining.
		 * https://github.com/evanw/esbuild/releases/tag/v0.14.25#:~:text=Minification%20now%20takes%20advantage%20of%20the%20%3F.%20operator
		 */
		export let foo = (x: any) => {
			if (x !== null && x !== undefined) x.y()
			return x === null || x === undefined ? undefined : x.z
		}
		`,

		'types.ts': outdent`
		export type SomeType = string | number;
		`,

		'utils.ts': outdent`
		import type { SomeType } from './types';
		export { writeFileSync } from 'fs';
		export { readFileSync } from 'node:fs';

		export function sayHello(name: SomeType) {
			return \`Hello \${name}!\`;
		}
		`,

		'value.js': outdent`
		#! /usr/bin/env node
		export default 1234;
		`,
	},

	node_modules: {
		'dependency-exports-dual': {
			'file.js': outdent`
			module.exports = 'cjs';
			`,
			'file.mjs': outdent`
			export default 'esm';
			`,
			'package.json': JSON.stringify({
				name: 'dependency-exports-dual',
				exports: {
					require: './file.js',
					import: './file.mjs',
				},
			}),
		},
		'dependency-imports-map': {
			'default.js': outdent`
			module.exports = 'default';
			`,
			'index.js': outdent`
			console.log(require('#conditional'));
			`,
			'node.js': outdent`
			module.exports = 'node';
			`,
			'package.json': JSON.stringify({
				name: 'dependency-exports-dual',
				imports: {
					'#conditional': {
						node: './node.js',
						default: './default.js',
					},
				},
			}),
		},
	},
};
