import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
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
