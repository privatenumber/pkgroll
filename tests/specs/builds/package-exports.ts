import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('package exports', ({ test }) => {
		test('string', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				exports: './dist/index.js',
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

		test('type module - string', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				type: 'module',
				exports: './dist/index.js',
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

		test('type module - object - string', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				type: 'module',
				exports: {
					'./something': './dist/index.js',
				},
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
		test('conditions', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				exports: {
					node: {
						import: './dist/utils.mjs',
						require: './dist/utils.cjs',
					},
					default: './dist/index.js',
				},
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

		test('conditions - import should allow cjs', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				exports: {
					node: {
						import: './dist/utils.js',
					},
					default: './dist/index.js',
				},
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
	});
});
