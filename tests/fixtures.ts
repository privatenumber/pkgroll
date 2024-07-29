import path from 'path';
import outdent from 'outdent';
import type { FileTree } from 'fs-fixture';
import type { PackageJson, TsConfigJson } from 'type-fest';

export const createPackageJson = (packageJson: PackageJson) => JSON.stringify(packageJson);
export const createTsconfigJson = (tsconfigJson: TsConfigJson) => JSON.stringify(tsconfigJson);

const typeScriptPath = path.resolve('node_modules/typescript');

export const installTypeScript: FileTree = {
	'node_modules/typescript': ({ symlink }) => symlink(typeScriptPath, 'dir'),
};

type Options = {
	installTypeScript?: boolean;
};

export const fixtureFiles = {
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

	pages: {
		'a.ts': outdent`
		export function render() {
			console.log('Page A');
		}
		`,
		'b.ts': outdent`
		export function render() {
			console.log('Page B');
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
	function preservesName() { return 2 ** 3; }
	export const functionName = preservesName.name;

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
};

export const packageFixture = (
	options: Options = {},
): FileTree => ({
	src: fixtureFiles,
	...(
		options.installTypeScript
			? installTypeScript
			: {}
	),
});

export const fixtureDependencyExportsMap = (
	entryFile: string,
): FileTree => ({
	'package.json': createPackageJson({
		main: entryFile,
	}),

	src: {
		'dependency-exports-require.js': outdent`
		console.log(require('dependency-exports-dual'));
		`,

		'dependency-exports-import.js': outdent`
		import esm from 'dependency-exports-dual';

		console.log(esm);
		`,
	},

	'node_modules/dependency-exports-dual': {
		'file.js': outdent`
		module.exports = 'cjs';
		`,
		'file.mjs': outdent`
		export default 'esm';
		`,
		'package.json': createPackageJson({
			name: 'dependency-exports-dual',
			exports: {
				require: './file.js',
				import: './file.mjs',
			},
		}),
	},
});

export const fixtureDependencyImportsMap: FileTree = {
	'package.json': createPackageJson({
		main: './dist/dependency-imports-map.js',
	}),

	'src/dependency-imports-map.js': outdent`
	import value from 'dependency-imports-map';
	console.log(value);
	`,

	'node_modules/dependency-imports-map': {
		'default.js': outdent`
		module.exports = 'default';
		`,
		'index.js': outdent`
		console.log(require('#conditional'));
		`,
		'node.js': outdent`
		module.exports = 'node';
		`,
		'package.json': createPackageJson({
			name: 'dependency-exports-dual',
			imports: {
				'#conditional': {
					node: './node.js',
					default: './default.js',
				},
			},
		}),
	},
};
