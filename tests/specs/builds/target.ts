import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll, installTypeScript } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('target', ({ describe, test }) => {
		test('transformation', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				main: './dist/target.js',
			});

			const pkgrollProcess = await pkgroll(['--target', 'es2015'], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/target.js', 'utf8');
			expect(content).toMatch('Math.pow');
		});

		describe('node protocol', () => {
			test('strips node protocol', async ({ onTestFinish }) => {
				const fixture = await createFixture('./tests/fixture-package');
				onTestFinish(async () => await fixture.rm());

				await installTypeScript(fixture.path);

				await fixture.writeJson('package.json', {
					main: './dist/utils.js',
					module: './dist/utils.mjs',
					types: './dist/utils.d.ts',
				});
				await fixture.writeJson('tsconfig.json', {
					compilerOptions: {
						jsx: 'react',
						typeRoots: [
							path.resolve('node_modules/@types'),
						],
					},
				});

				const pkgrollProcess = await pkgroll(['--target', 'node12.19'], { cwd: fixture.path, nodePath });

				expect(pkgrollProcess.exitCode).toBe(0);
				expect(pkgrollProcess.stderr).toBe('');

				expect(await fixture.readFile('dist/utils.js', 'utf8')).not.toMatch('node:');
				expect(await fixture.readFile('dist/utils.mjs', 'utf8')).not.toMatch('node:');

				const content = await fixture.readFile('dist/utils.d.ts', 'utf8');
				expect(content).toMatch('declare function');
				expect(content).not.toMatch('node:');
			});

			test('keeps node protocol', async ({ onTestFinish }) => {
				const fixture = await createFixture('./tests/fixture-package');
				onTestFinish(async () => await fixture.rm());

				installTypeScript(fixture.path);

				await fixture.writeJson('package.json', {
					main: './dist/utils.js',
					module: './dist/utils.mjs',
					types: './dist/utils.d.ts',
				});
				await fixture.writeJson('tsconfig.json', {
					compilerOptions: {
						jsx: 'react',
						typeRoots: [
							path.resolve('node_modules/@types'),
						],
					},
				});

				const pkgrollProcess = await pkgroll(['--target', 'node14.18'], { cwd: fixture.path, nodePath });

				expect(pkgrollProcess.exitCode).toBe(0);
				expect(pkgrollProcess.stderr).toBe('');

				expect(await fixture.readFile('dist/utils.js', 'utf8')).toMatch('\'node:fs\'');
				expect(await fixture.readFile('dist/utils.mjs', 'utf8')).toMatch('\'node:fs\'');

				const content = await fixture.readFile('dist/utils.d.ts', 'utf8');
				expect(content).toMatch('\'fs\'');
				expect(content).toMatch('\'node:fs\'');
			});
		});
	});
});
