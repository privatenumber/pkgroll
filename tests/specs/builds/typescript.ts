import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { outdent } from 'outdent';
import { pkgroll } from '../../utils.js';
import { createPackageJson, createTsconfigJson } from '../../fixtures.js';

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

		test('resolves bare module paths ', async () => {
			await using fixture = await createFixture({
				src: {
					'index.ts': outdent`
					import { qux } from 'nested/exportee.js';
					import { quux } from 'nested/deep/exportee.js';
					console.log(qux, quux);
					export { qux, quux };`,
					'importee.ts': outdent`export const foo = () => 'foo';`,
					nested: {
						'importee.ts': outdent`export const bar = () => 'bar';`,
						'exportee.ts': outdent`
						import { foo } from 'importee.js';
						import { baz } from 'nested/deep/importee.js';
						export const qux = foo() + baz();`,
						deep: {
							'importee.ts': outdent`export const baz = () => 'baz';`,
							'exportee.ts': outdent`
							import { foo } from 'importee.js';
							import { bar } from 'nested/importee.js';
							import { baz } from 'nested/deep/importee.js';
							export const quux = foo() + bar() + baz();`,
						},
					},
				},
				'package.json': createPackageJson({
					type: 'module',
					exports: {
						'.': './dist/index.js',
						'./nested': './dist/nested/exportee.js',
						'./deep': './dist/nested/deep/exportee.js',
					},
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						baseUrl: './src',
					},
				}),
			});

			const pkgrollProcess = await pkgroll(['--env.NODE_ENV=development'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			/** @todo expect */
			// const contents = await Promise.all([
			// 	'./dist/index.js',
			// 	'./dist/nested/exportee.js',
			// 	'./dist/nested/deep/exportee.js',
			// ].map(file => fixture.readFile(file, 'utf-8')));

			// contents.forEach(content => console.log(content.split('\n'), '\n'))
		});

		test('resolves mapped module paths ', async () => {
			await using fixture = await createFixture({
				src: {
					'index.ts': outdent`
					import * as foo from '@foo/index.js';
					import { bar } from '$bar/bar.js';
					import { baz } from '~baz';
					export { foo, bar, baz };`,
					foo: {
						'index.ts': outdent`
						export { a } from '@foo/a.js';
						export { b } from '@foo/b.js';`,
						'a.ts': `export const a = () => 'a';`,
						'b.ts': `export const b = () => 'b';`,
					},
					bar: {
						'bar.ts': `export const bar = () => 'bar';`,
					},
					baz: {
						'baz.ts': `export const baz = () => 'baz';`,
					},
				},
				'package.json': createPackageJson({
					type: 'module',
					exports: {
						'.': './dist/index.js',
						'./foo': './dist/foo/index.js',
					},
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						paths: {
							'@foo/*': ['./src/foo/*'],
							'$bar/*': ['./src/bar/*'],
							'~baz': ['./src/baz/baz.ts'],
						},
					},
				}),
			});

			const pkgrollProcess = await pkgroll(['--env.NODE_ENV=development'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			/** @todo expect */
			// const contents = await Promise.all([
			// 	'./dist/index.js',
			// 	'./dist/foo/index.js',
			// ].map(file => fixture.readFile(file, 'utf-8')));

			// contents.forEach(content => console.log(content.split('\n'), '\n'))
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
			const fixture = await createFixture({
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
