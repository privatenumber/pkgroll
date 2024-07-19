import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { packageFixture, createPackageJson } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('package exports', ({ test }) => {
		test('string', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					exports: './dist/index.js',
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

		test('type module - string', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					type: 'module',
					exports: './dist/index.js',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('export {');
		});

		test('type module - object - string', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					type: 'module',
					exports: {
						'./something': './dist/index.js',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('export {');
		});

		/**
		 * This test generates an extra index.cjs, because the rollup
		 * config generator finds that they can be build in the same config.
		 *
		 * This actually seems more performant because only one build is procuced
		 * instead of two just to remove one file. If this is problematic,
		 * we can consider deleting or intercepting file emission.
		 */
		test('conditions', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					exports: {
						node: {
							import: './dist/utils.mjs',
							require: './dist/utils.cjs',
						},
						default: './dist/index.js',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const indexMjs = await fixture.readFile('dist/index.js', 'utf8');
			expect(indexMjs).toMatch('module.exports =');

			const utilsMjs = await fixture.readFile('dist/utils.mjs', 'utf8');
			expect(utilsMjs).toMatch('export {');

			const utilsCjs = await fixture.readFile('dist/utils.cjs', 'utf8');
			expect(utilsCjs).toMatch('exports.sayHello =');
		});

		test('conditions - import should allow cjs', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					exports: {
						node: {
							import: './dist/utils.js',
						},
						default: './dist/index.js',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const indexMjs = await fixture.readFile('dist/index.js', 'utf8');
			expect(indexMjs).toMatch('module.exports =');

			const utilsMjs = await fixture.readFile('dist/utils.js', 'utf8');
			expect(utilsMjs).toMatch('exports.sayHello =');
		});

		test('conditions - wildcard subpath exports', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					exports: {
						'./pages/*': {
							import: './dist/pages/*.mjs',
							require: './dist/pages/*.cjs',
							types: './dist/pages/*.d.ts',
						},
						'.': './dist/index.js',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const indexCjs = await fixture.readFile('dist/pages/a.cjs', 'utf8');
			expect(indexCjs).toMatch('exports.render');
			const indexMjs = await fixture.readFile('dist/pages/a.mjs', 'utf8');
			expect(indexMjs).toMatch('export { render }');
			const utilsCjs = await fixture.readFile('dist/pages/b.cjs', 'utf8');
			expect(utilsCjs).toMatch('exports.render');
			const utilsMjs = await fixture.readFile('dist/pages/b.mjs', 'utf8');
			expect(utilsMjs).toMatch('export { render }');

			expect(await fixture.exists('dist/index.js')).toEqual(true);
			expect(await fixture.exists('dist/pages/a.js')).toEqual(true);
			expect(await fixture.exists('dist/pages/b.js')).toEqual(true);
			expect(await fixture.exists('dist/pages/a.d.ts')).toEqual(true);
			expect(await fixture.exists('dist/pages/b.d.ts')).toEqual(true);
		});
	});
});
