import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { outdent } from 'outdent';
import { pkgroll } from '../../utils.ts';
import { createPackageJson, createTsconfigJson, installTypeScript } from '../../fixtures.ts';

export const typescript = (nodePath: string) => describe('TypeScript', () => {
	test('resolves .jsx -> .tsx', async () => {
		await using fixture = await createFixture({
			src: {
				'index.ts': 'import "./file.jsx"',
				'file.tsx': 'console.log(1)',
			},
			'package.json': createPackageJson({
				main: './dist/index.js',
				type: 'module',
			}),
		});

		const pkgrollProcess = await pkgroll(['--env.NODE_ENV=development'], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		expect(content).toBe('console.log(1);\n');
	});

	test('resolves .jsx from .js', async () => {
		await using fixture = await createFixture({
			src: {
				'index.js': 'import "./file.jsx"',
				'file.jsx': 'console.log(1)',
			},
			'package.json': createPackageJson({
				main: './dist/index.js',
				type: 'module',
			}),
		});

		const pkgrollProcess = await pkgroll(['--env.NODE_ENV=development'], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		expect(content).toBe('console.log(1);\n');
	});

	test('resolves baseUrl', async () => {
		await using fixture = await createFixture({
			src: {
				'index.ts': outdent`
				import { qux } from 'dir/exportee.js';
				import { quux } from 'dir/deep/exportee.js';
				console.log(qux, quux);
				`,
				'importee.ts': 'export const foo = \'foo\'',
				dir: {
					'importee.ts': 'export const bar = \'bar\'',
					'exportee.ts': outdent`
					import { foo } from 'importee.js';
					import { baz } from 'dir/deep/importee.js';
					export const qux = foo + baz;`,
					deep: {
						'importee.ts': 'export const baz = \'baz\'',
						'exportee.ts': outdent`
						import { foo } from 'importee.js';
						import { bar } from 'dir/importee.js';
						import { baz } from 'dir/deep/importee.js';
						export const quux = foo + bar + baz;`,
					},
				},
			},
			'package.json': createPackageJson({
				exports: './dist/index.mjs',
			}),
			'tsconfig.json': createTsconfigJson({
				compilerOptions: {
					baseUrl: './src',
				},
			}),
		});

		const pkgrollProcess = await pkgroll(['--minify'], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.mjs', 'utf8');
		expect(content).toMatch('"foo"');
		expect(content).toMatch('"bar"');
		expect(content).toMatch('"baz"');
	});

	test('resolves paths', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			src: {
				'index.ts': outdent`
				import * as foo from '@foo/index.js';
				import { bar } from '~bar';
				import { baz } from '#baz';
				export { foo, bar, baz };`,
				foo: {
					'index.ts': 'export { a } from \'@foo/a.js\';',
					'a.ts': 'export const a = \'a\';',
				},
				'bar/index.ts': 'export const bar = \'bar\';',
				'baz.ts': 'export const baz = \'baz\';',
			},
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.mts',
					default: './dist/index.mjs',
				},
			}),
			'tsconfig.json': createTsconfigJson({
				compilerOptions: {
					paths: {
						'@foo/*': ['./src/foo/*'],
						'~bar': ['./src/bar/index.ts'],
						'#baz': ['./src/baz.ts'],
					},
				},
			}),
		});

		const pkgrollProcess = await pkgroll(['--minify'], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.mjs', 'utf8');
		expect(content).toMatch('"a"');
		expect(content).toMatch('"bar"');
		expect(content).toMatch('"baz"');
	});

	test('prefer .ts over .js in source code', async () => {
		// In source code, TypeScript files should be preferred over JavaScript
		// when both exist for the same import specifier
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				main: './dist/index.js',
				type: 'module',
			}),

			src: {
				'index.ts': 'import { value } from "./file.js"; console.log(value);',
				// Both files exist, .ts should be preferred
				'file.ts': 'export const value = "from-typescript";',
				'file.js': 'export const value = "from-javascript";',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');

		// Should prefer .ts when both exist in source code
		expect(content).toMatch('from-typescript');
		expect(content).not.toMatch('from-javascript');
	});

	test('prefer .js over .ts in node_modules (esbuild behavior)', async () => {
		// Tests esbuild's resolution behavior where .js is preferred over .ts
		// in node_modules to avoid issues with:
		// 1. Packages that accidentally ship both .js and .ts
		// 2. Missing or unpublished tsconfig.json
		//
		// Resolution order:
		// - Source code: .ts before .js
		// - node_modules: .js before .ts
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				main: './dist/index.js',
				devDependencies: {
					'pkg-with-both': '*',
					'pkg-with-only-ts': '*',
				},
			}),

			'src/index.ts': `
			import { fromBoth } from 'pkg-with-both';
			import { fromTs } from 'pkg-with-only-ts';
			console.log(fromBoth, fromTs);
			`,

			node_modules: {
				'pkg-with-both': {
					'package.json': createPackageJson({
						name: 'pkg-with-both',
						type: 'module',
						main: './index.js',
					}),
					// Entry point imports from a relative file
					'index.js': 'export { fromBoth } from "./file.js";',
					// Package accidentally ships both .js and .ts for the same file
					'file.js': 'export const fromBoth = "compiled-js";',
					'file.ts': 'export const fromBoth: string = "source-ts";',
				},

				'pkg-with-only-ts': {
					'package.json': createPackageJson({
						name: 'pkg-with-only-ts',
						type: 'module',
						main: './index.js',
					}),
					'index.js': 'export { fromTs } from "./file.js";',
					// Package only ships .ts (forgot to compile or .npmignore misconfigured)
					'file.ts': 'export const fromTs: string = "only-ts";',
				},
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');

		// Should prefer .js when both exist in node_modules
		expect(content).toMatch('compiled-js');
		expect(content).not.toMatch('source-ts');

		// Should use .ts when only .ts exists in node_modules
		expect(content).toMatch('only-ts');
	});

	describe('custom tsconfig.json path', () => {
		test('respects compile target', async () => {
			await using fixture = await createFixture({
				src: {
					'index.ts': 'export default () => "foo";',
				},
				'package.json': createPackageJson({
					main: './dist/index.js',
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						target: 'ES6',
					},
				}),
				'tsconfig.build.json': createTsconfigJson({
					compilerOptions: {
						target: 'ES5',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([
				'--env.NODE_ENV=test',
				'--tsconfig=tsconfig.build.json',
			], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content.includes('function')).toBe(true);
		});

		test('error on invalid tsconfig.json path', async () => {
			await using fixture = await createFixture({
				src: {
					'index.ts': 'export default () => "foo";',
				},
				'package.json': createPackageJson({
					main: './dist/index.js',
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						target: 'ES6',
					},
				}),
				'tsconfig.build.json': createTsconfigJson({
					compilerOptions: {
						target: 'ES5',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([
				'--env.NODE_ENV=test',
				'--tsconfig=tsconfig.invalid.json',
			], {
				cwd: fixture.path,
				nodePath,
				reject: false,
			});

			expect(pkgrollProcess.exitCode).toBe(1);
			// expect(pkgrollProcess.stderr).toMatch('Cannot resolve tsconfig at path:');
		});
	});
});
