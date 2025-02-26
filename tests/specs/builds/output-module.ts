import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import {
	packageFixture, createPackageJson, createTsconfigJson, fixtureDynamicImports,
	fixtureDynamicImportUnresolvable,
} from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('output: module', ({ test }) => {
		test('{ type: module, field: main, srcExt: js, distExt: js }', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.js',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('export { index as default }');
		});

		test('{ type: commonjs, field: main, srcExt: js, distExt: mjs }', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					main: './dist/index.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('export { index as default }');
		});

		test('{ type: commonjs, field: module, srcExt: js, distExt: js }', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					module: './dist/index.js',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('export { index as default }');
		});

		test('{ type: commonjs, field: main, srcExt: cjs, distExt: mjs }', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					main: './dist/cjs.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/cjs.mjs', 'utf8');
			expect(content).toMatch('export { cjs as default }');
		});

		test('{ type: commonjs, field: component, srcExt: tsx, distExt: mjs }', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installReact: true }),
				'package.json': createPackageJson({
					main: './dist/component.mjs',
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/component.mjs', 'utf8');
			expect(content).toMatch('import { jsx } from \'react/jsx-runtime\'');
			expect(content).toMatch('const Component = () => /* @__PURE__ */ jsx("div", { children: "Hello World" })');
			expect(content).toMatch('export { Component }');
		});

		test('{ type: commonjs, field: main, srcExt: mts, distExt: mjs }', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					main: './dist/mts.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/mts.mjs', 'utf8');
			expect(content).toMatch('export { foo, sayGoodbye, sayHello, sayHello$1 as sayHello2 }');
		});

		test('{ type: commonjs, field: main, srcExt: cts, distExt: mjs }', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					main: './dist/cts.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/cts.mjs', 'utf8');
			expect(content).toMatch('export { sayHello }');
		});

		test('{ type: module, field: main, srcExt: cts, distExt: js }', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/cts.js',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/cts.js', 'utf8');
			expect(content).toMatch('export { sayHello }');
		});

		test('require() gets converted to import in esm', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					main: './dist/require.js',
					module: './dist/require.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll(['--minify'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const js = await fixture.readFile('dist/require.js', 'utf8');
			expect(js).not.toMatch('createRequire');

			const mjs = await fixture.readFile('dist/require.mjs', 'utf8');
			expect(mjs).not.toMatch('require(');
			expect(mjs).toMatch(/import . from"fs"/);
		});

		test('conditional require() no side-effects', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					main: './dist/conditional-require.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/conditional-require.mjs', 'utf8');
			expect(content).toMatch('\tconsole.log("side effect");');
		});

		test('require() & createRequire gets completely removed on conditional', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					main: './dist/conditional-require.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll(['--env.NODE_ENV=development', '--minify'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/conditional-require.mjs', 'utf8');
			expect(content).not.toMatch('\tconsole.log(\'side effect\');');
			expect(content).not.toMatch('require(');
			expect(content).toMatch('"development"');
		});

		describe('injects createRequire', ({ test }) => {
			test('dynamic require should get a createRequire', async () => {
				await using fixture = await createFixture({
					'src/dynamic-require.ts': 'require((() => \'fs\')());',
					'package.json': createPackageJson({
						main: './dist/dynamic-require.mjs',
					}),
				});

				const pkgrollProcess = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(pkgrollProcess.exitCode).toBe(0);
				expect(pkgrollProcess.stderr).toBe('');

				const content = await fixture.readFile('dist/dynamic-require.mjs', 'utf8');
				expect(content).toMatch('createRequire');
				expect(content).toMatch('(import.meta.url)');

				// Shouldn't throw
				await import(pathToFileURL(fixture.getPath('dist/dynamic-require.mjs')).toString());
			});

			test('defined require should not get a createRequire', async () => {
				await using fixture = await createFixture({
					'src/dynamic-require.ts': 'const require=console.log; require((() => \'fs\')());',
					'package.json': createPackageJson({
						main: './dist/dynamic-require.mjs',
					}),
				});

				const pkgrollProcess = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(pkgrollProcess.exitCode).toBe(0);
				expect(pkgrollProcess.stderr).toBe('');

				const content = await fixture.readFile('dist/dynamic-require.mjs', 'utf8');
				expect(content).not.toMatch('createRequire');
				expect(content).not.toMatch('(import.meta.url)');
				expect(content).toMatch('"fs"');
			});

			test('object property should not get a createRequire', async () => {
				await using fixture = await createFixture({
					'src/dynamic-require.ts': 'console.log({ require: 1 });',
					'package.json': createPackageJson({
						main: './dist/dynamic-require.mjs',
					}),
				});

				const pkgrollProcess = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(pkgrollProcess.exitCode).toBe(0);
				expect(pkgrollProcess.stderr).toBe('');

				const content = await fixture.readFile('dist/dynamic-require.mjs', 'utf8');
				expect(content).not.toMatch('createRequire');
				expect(content).not.toMatch('(import.meta.url)');
			});
		});

		test('dynamic imports', async () => {
			await using fixture = await createFixture({
				...fixtureDynamicImports,
				'package.json': createPackageJson({
					exports: './dist/dynamic-imports.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dynamic-imports.mjs', 'utf8');
			expect(content).toMatch('import(');

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
					exports: './dist/dynamic-imports.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toContain('[plugin rollup-plugin-dynamic-import-variables]');

			const content = await fixture.readFile('dist/dynamic-imports.mjs', 'utf8');
			expect(content).toMatch('import(');
		});

		// https://github.com/privatenumber/pkgroll/issues/115
		test('import.meta.url should be preserved', async () => {
			await using fixture = await createFixture({
				'src/index.js': 'console.log(import.meta.url)',
				'package.json': createPackageJson({
					exports: './dist/index.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll(['--target=es2017'], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('import.meta.url');
		});
	});
});
