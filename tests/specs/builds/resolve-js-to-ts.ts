import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import { createPackageJson } from '../../fixtures.ts';

export const resolveJsToTs = (nodePath: string) => describe('resolve-js-to-ts', () => {
	describe('relative imports (source code)', () => {
		test('./file.js resolves to ./file.ts', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
				}),
				'src/index.ts': `
					import { value } from './utils.js';
					export { value };
				`,
				'src/utils.ts': 'export const value = "from-ts";',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('from-ts');
		});
	});

	describe('bare specifiers (package imports)', () => {
		test('wildcard exports - should resolve .js through exports map', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
					devDependencies: {
						'dep-wildcard': '*',
					},
				}),

				'src/index.ts': `
					import { value } from 'dep-wildcard/utils.js';
					export { value };
				`,

				'node_modules/dep-wildcard': {
					'package.json': createPackageJson({
						name: 'dep-wildcard',
						type: 'module',
						exports: {
							'./*.js': './dist/*.js',
							'./*': './dist/*.js',
						},
					}),
					'dist/utils.js': 'export const value = "hello";',
				},
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('hello');
		});

		test('scoped package with wildcard exports', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
					devDependencies: {
						'@scope/dep-wildcard': '*',
					},
				}),

				'src/index.ts': `
					import { value } from '@scope/dep-wildcard/utils.js';
					export { value };
				`,

				'node_modules/@scope/dep-wildcard': {
					'package.json': createPackageJson({
						name: '@scope/dep-wildcard',
						type: 'module',
						exports: {
							'./*.js': './dist/*.js',
							'./*': './dist/*.js',
						},
					}),
					'dist/utils.js': 'export const value = "scoped-hello";',
				},
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('scoped-hello');
		});

		test('.mjs bare specifier with wildcard exports', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
					devDependencies: {
						'dep-mjs': '*',
					},
				}),

				'src/index.ts': `
					import { value } from 'dep-mjs/utils.mjs';
					export { value };
				`,

				'node_modules/dep-mjs': {
					'package.json': createPackageJson({
						name: 'dep-mjs',
						type: 'module',
						exports: {
							'./*': './dist/*',
						},
					}),
					'dist/utils.mjs': 'export const value = "from-mjs";',
				},
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('from-mjs');
		});

		test('dep ships both .js and .ts - should prefer .js', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
					devDependencies: {
						'dep-both': '*',
					},
				}),

				'src/index.ts': `
					import { value } from 'dep-both/file.js';
					export { value };
				`,

				'node_modules/dep-both': {
					'package.json': createPackageJson({
						name: 'dep-both',
						type: 'module',
						main: './index.js',
					}),
					'file.js': 'export const value = "compiled-js";',
					'file.ts': 'export const value: string = "source-ts";',
				},
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('compiled-js');
			expect(content).not.toMatch('source-ts');
		});

		test('dep ships only .ts - should fallback to .ts', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
					devDependencies: {
						'dep-ts-only': '*',
					},
				}),

				'src/index.ts': `
					import { value } from 'dep-ts-only/file.js';
					export { value };
				`,

				'node_modules/dep-ts-only': {
					'package.json': createPackageJson({
						name: 'dep-ts-only',
						type: 'module',
						main: './index.js',
					}),
					'file.ts': 'export const value: string = "only-ts";',
				},
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('only-ts');
		});
	});
});
