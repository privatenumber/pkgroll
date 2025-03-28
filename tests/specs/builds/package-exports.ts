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

		test('conditions - types', async () => {
			await using fixture = await createFixture({
				...packageFixture({
					installTypeScript: true,
				}),
				'package.json': createPackageJson({
					type: 'module',
					exports: {
						types: {
							default: './dist/mts.d.ts',
						},
						import: './dist/mts.js',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const indexMjs = await fixture.readFile('dist/mts.js', 'utf8');
			expect(indexMjs).toMatch('function sayGoodbye(name) {');

			const indexDts = await fixture.readFile('dist/mts.d.ts', 'utf8');
			expect(indexDts).toMatch('declare function sayGoodbye(name: string): void;');
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

		test('get basename with dot', async () => {
			await using fixture = await createFixture({
				...packageFixture({
					installTypeScript: true,
				}),
				src: {
					'index.node.ts': 'export default () => "foo";',
					nested: {
						'index.node.ts': 'export default () => "foo";',
					},
				},
				'package.json': createPackageJson({
					exports: {
						'./': {
							default: './dist/index.node.js',
							types: './dist/index.node.d.ts',
						},
						'./nested': {
							default: './dist/nested/index.node.js',
							types: './dist/nested/index.node.d.ts',
						},
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.node.js', 'utf8');
			expect(content).toMatch('module.exports =');
			await fixture.exists('dist/index.node.d.ts');
			await fixture.exists('dist/nested/index.node.js');
			await fixture.exists('dist/nested/index.node.d.ts');
		});

		test('publishConfig', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					exports: './dist/invalid.js',
					publishConfig: {
						exports: './dist/index.js',
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
			expect(content).toMatch('module.exports =');
		});
	});
});
