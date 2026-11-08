import fs from 'node:fs/promises';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import { node } from '../../utils/with-node.ts';
import {
	packageFixture, createPackageJson, createTsconfigJson, fixtureDynamicImports,
	fixtureDynamicImportUnresolvable,
} from '../../fixtures.ts';

export const outputCommonjs = () => describe('output: commonjs', () => {
	test('{ type: commonjs, field: main, srcExt: js, distExt: js }', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/index.js',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		expect(content).toMatch('module.exports =');
	});

	test('{ type: commonjs, field: main, srcExt: mts, distExt: js }', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/mts.js',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/mts.js', 'utf8');
		expect(content).toMatch('exports.sayHello =');
	});

	test('{ type: commonjs, field: main, srcExt: cts, distExt: js }', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/cts.js',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/cts.js', 'utf8');
		expect(content).toMatch('exports.sayHello =');
	});

	test('{ type: commonjs, field: main, srcExt: cts, distExt: cjs }', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/cts.cjs',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/cts.cjs', 'utf8');
		expect(content).toMatch('exports.sayHello =');
	});

	test('{ type: module, field: main, srcExt: js, distExt: cjs }', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.cjs',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.cjs', 'utf8');
		expect(content).toMatch('module.exports =');
	});

	test('{ type: commonjs, field: main, srcExt: mjs, distExt: cjs }', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/mjs.cjs',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/mjs.cjs', 'utf8');
		expect(content).toMatch('exports.sayHello =');
	});

	test('{ type: commonjs, field: component, srcExt: mjs, distExt: cjs }', async () => {
		await using fixture = await createFixture({
			...packageFixture({ installReact: true }),
			'package.json': createPackageJson({
				main: './dist/component.cjs',
				peerDependencies: {
					react: '*',
				},
			}),
			'tsconfig.json': createTsconfigJson({
				compilerOptions: {
					jsx: 'react-jsx',
				},
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/component.cjs', 'utf8');
		expect(content).toMatch('require(\'react/jsx-runtime\')');
		expect(content).toMatch('const Component = () => /* @__PURE__ */ jsxRuntime.jsx("div", { children: "Hello World" })');
		expect(content).toMatch('exports.Component = Component');
	});

	test('nested directory', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/nested/index.js',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/nested/index.js', 'utf8');
		expect(content).toMatch('nested entry point');
	});

	test('dynamic imports', async () => {
		await using fixture = await createFixture({
			...fixtureDynamicImports,
			'package.json': createPackageJson({
				exports: './dist/dynamic-imports.cjs',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/dynamic-imports.cjs', 'utf8');
		expect(content).toMatch('require(');

		const files = await fs.readdir(fixture.getPath('dist'));
		files.sort();
		expect(files[0]).toMatch(/^aaa-/);
		expect(files[1]).toMatch(/^bbb-/);
		expect(files[2]).toMatch(/^ccc-/);
	});

	// https://github.com/privatenumber/pkgroll/issues/104
	test('unresolvable dynamic import should not fail', async () => {
		await using fixture = await createFixture({
			...fixtureDynamicImportUnresolvable,
			'package.json': createPackageJson({
				exports: './dist/dynamic-imports.cjs',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
		});

		expect(pkgrollProcess.stderr).toContain('[plugin rollup-plugin-dynamic-import-variables]');

		const content = await fixture.readFile('dist/dynamic-imports.cjs', 'utf8');
		expect(content).toMatch('import(');
	});

	describe('preserves cjs-module-lexer compatibility for node', () => {
		test('escapes line separators in export annotations', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: './dist/index.cjs',
				}),
				src: {
					'index.js': String.raw`exports['\u2028'] = 1; exports['\u2029'] = 2;`,
				},
			});

			await pkgroll(['--minify'], { cwd: fixture.path });
			const content = await fixture.readFile('dist/index.cjs', 'utf8');
			expect(content).toContain(String.raw`0&&(module.exports={"\u2028":exports,"\u2029":exports});`);
			await node(['--check', fixture.getPath('dist/index.cjs')]);
		});

		test('exports arbitrary names to ESM', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: './dist/index.cjs',
				}),
				src: {
					'index.js': `
					exports['foo-bar'] = 1;
					exports.default = 2;
					exports.class = 3;
					exports['quote"name'] = 4;
					exports.ordinary = 5;
					exports.let = 6;
					exports.yield = 7;
					exports.await = 8;
					exports['é'] = 9;
					exports.eval = 11;
					exports.arguments = 12;
					`,
				},
				'consumer.mjs': String.raw`
					import value, { "foo-bar" as foo, class as reserved, "quote\"name" as quoted, await as awaited, ordinary } from './dist/index.cjs';
					import * as ns from './dist/index.cjs';
					console.log(JSON.stringify({ value, foo, reserved, quoted, awaited, ordinary, ns: { foo: ns['foo-bar'], class: ns.class, let: ns.let, yield: ns.yield, é: ns['é'], await: ns.await, ordinary: ns.ordinary } }));
				`,
			});

			await pkgroll(['--minify'], { cwd: fixture.path });

			const content = await fixture.readFile('dist/index.cjs', 'utf8');
			expect(content).toMatch('"default":exports');
			expect(content).toMatch('0&&(module.exports={ordinary,await,eval,arguments,é,"default":exports,"class":exports,"let":exports,"yield":exports,"foo-bar":exports,');
			const { stdout } = await node([fixture.getPath('consumer.mjs')]);
			const {
				value, foo, reserved, quoted, awaited, ordinary, ns,
			} = JSON.parse(stdout);
			expect({
				foo,
				reserved,
				quoted,
				awaited,
				ordinary,
			}).toStrictEqual({
				foo: 1,
				reserved: 3,
				quoted: 4,
				awaited: 8,
				ordinary: 5,
			});
			expect(value).toStrictEqual({
				'foo-bar': 1,
				default: 2,
				class: 3,
				'quote"name': 4,
				ordinary: 5,
				let: 6,
				yield: 7,
				await: 8,
				é: 9,
				eval: 11,
				arguments: 12,
			});
			expect(ns).toStrictEqual({
				foo: 1,
				class: 3,
				let: 6,
				yield: 7,
				é: 9,
				await: 8,
				ordinary: 5,
			});
		});

		test('exports', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: './dist/index.cjs',
				}),

				src: {
					'index.js': `
					require('./foo.js');
					exports.foo = 1;
					`,
					'foo.js': 'exports.bar = 2',
				},
			});

			await pkgroll([], {
				cwd: fixture.path,
			});

			const content = await fixture.readFile('dist/index.cjs', 'utf8');
			expect(content).toMatch('0&&(module.exports={foo});');
		});

		test('reexports', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: './dist/index.cjs',
				}),

				src: {
					'index.js': `
					module.exports = require('./bar.js');
					`,
					'bar.js': 'exports.bar = 1',
				},
			});

			await pkgroll([], {
				cwd: fixture.path,
			});

			const content = await fixture.readFile('dist/index.cjs', 'utf8');
			expect(content).toMatch('0&&(module.exports={bar});');
		});

		test('minified', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: './dist/index.cjs',
				}),

				src: {
					'index.js': `
					module.exports = require('./bar.js');
					`,
					'bar.js': 'exports.bar = 1',
				},
			});

			await pkgroll(['--minify'], {
				cwd: fixture.path,
			});

			const content = await fixture.readFile('dist/index.cjs', 'utf8');
			expect(content).toMatch('0&&(module.exports={bar});');
		});
	});
});
