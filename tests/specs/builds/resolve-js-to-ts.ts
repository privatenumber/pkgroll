import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import { createPackageJson } from '../../fixtures.ts';

export const resolveJsToTs = (nodePath: string) => describe('resolve-js-to-ts', () => {
	describe('relative imports (source code)', () => {
		// esbuild: rewrittenFileExtensions ".js" → [".ts", ".tsx"]
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1723-L1730
		// TypeScript: tryAddingExtensions case .Js → tries .ts then .tsx
		// https://github.com/microsoft/TypeScript/blob/main/src/compiler/moduleNameResolver.ts#L2168-L2176
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

		// esbuild: rewrittenFileExtensions ".js" → [".ts", ".tsx"] — tries .tsx if .ts missing
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1726
		// TypeScript: tryAddingExtensions case .Js → .ts || .tsx
		// https://github.com/microsoft/TypeScript/blob/main/src/compiler/moduleNameResolver.ts#L2172
		test('./file.js resolves to ./file.tsx when .ts does not exist', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
				}),
				'src/index.ts': `
					import { Component } from './component.js';
					export { Component };
				`,
				'src/component.tsx': 'export const Component = "tsx-component";',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('tsx-component');
		});

		// esbuild: rewrittenFileExtensions ".jsx" → [".ts", ".tsx"] — tries .ts first
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1724-L1727
		// TypeScript: tryAddingExtensions case .Jsx → .tsx || .ts
		// https://github.com/microsoft/TypeScript/blob/main/src/compiler/moduleNameResolver.ts#L2159-L2166
		test('./file.jsx resolves to ./file.ts when .tsx does not exist', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
				}),
				'src/index.ts': `
					import { value } from './utils.jsx';
					export { value };
				`,
				'src/utils.ts': 'export const value = "from-ts-via-jsx";',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('from-ts-via-jsx');
		});
	});

	describe('bare specifiers (package imports)', () => {
		// esbuild: exports map resolves specifier first, .js→.ts only if resolved file missing
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L2651-L2670
		// TypeScript: loadFileNameFromPackageJsonField applies .js→.ts on resolved path
		// https://github.com/microsoft/TypeScript/blob/main/src/compiler/moduleNameResolver.ts#L2112-L2128
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

		// esbuild: rewrittenFileExtensions ".mjs" → [".mts"]
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1728
		// TypeScript: tryAddingExtensions case .Mjs → .mts
		// https://github.com/microsoft/TypeScript/blob/main/src/compiler/moduleNameResolver.ts#L2141-L2147
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

		// esbuild v0.18.0: prefer .js over .ts within node_modules
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1919-L1927
		// loadAsFile tries literal path (step 1) before .js→.ts rewriting (step 3)
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1816-L1828
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

		// esbuild: .js→.ts rewriting as last resort when file doesn't exist
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1828-L1843
		// esbuild v0.18.12: also applies inside packages with exports field
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L2653-L2670
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

		// esbuild: rewrittenFileExtensions ".js" → [".ts", ".tsx"] — tries .tsx if .ts missing
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1726
		// TypeScript: tryAddingExtensions case .Js → .ts || .tsx
		// https://github.com/microsoft/TypeScript/blob/main/src/compiler/moduleNameResolver.ts#L2172
		test('dep ships only .tsx - should fallback from .js to .tsx', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
					devDependencies: {
						'dep-tsx-only': '*',
					},
				}),

				'src/index.ts': `
					import { Component } from 'dep-tsx-only/component.js';
					export { Component };
				`,

				'node_modules/dep-tsx-only': {
					'package.json': createPackageJson({
						name: 'dep-tsx-only',
						type: 'module',
						main: './index.js',
					}),
					'component.tsx': 'export const Component = "tsx-only";',
				},
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('tsx-only');
		});

		// esbuild: rewrittenFileExtensions ".jsx" → [".ts", ".tsx"]
		// https://github.com/evanw/esbuild/blob/main/internal/resolver/resolver.go#L1724-L1727
		test('bare specifier .jsx resolves to .ts when .tsx does not exist', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
					devDependencies: {
						'dep-jsx-ts': '*',
					},
				}),

				'src/index.ts': `
					import { value } from 'dep-jsx-ts/utils.jsx';
					export { value };
				`,

				'node_modules/dep-jsx-ts': {
					'package.json': createPackageJson({
						name: 'dep-jsx-ts',
						type: 'module',
						main: './index.js',
					}),
					'utils.ts': 'export const value = "bare-ts-via-jsx";',
				},
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('bare-ts-via-jsx');
		});
	});
});
