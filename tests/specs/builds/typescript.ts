import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { outdent } from 'outdent';
import { pkgroll } from '../../utils.js';
import { createPackageJson, createTsconfigJson, installTypeScript } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('TypeScript', ({ test }) => {
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
	});

	describe('custom tsconfig.json path', ({ test }) => {
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
