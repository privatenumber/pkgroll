import fs from 'node:fs/promises';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import {
	packageFixture, createPackageJson, createTsconfigJson, fixtureDynamicImports,
	fixtureDynamicImportUnresolvable,
} from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('output: commonjs', ({ test }) => {
		test('{ type: commonjs, field: main, srcExt: js, distExt: js }', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
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
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toContain('[plugin rollup-plugin-dynamic-import-variables]');

			const content = await fixture.readFile('dist/dynamic-imports.cjs', 'utf8');
			expect(content).toMatch('import(');
		});
	});
});
