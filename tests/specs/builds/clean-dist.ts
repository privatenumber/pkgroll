import path from 'path';
import fs from 'fs/promises';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll, installTypeScript } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('clean dist', ({ test }) => {
		test('no flag', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				main: './dist/nested/index.js',
				module: './dist/nested/index.mjs',
				types: './dist/nested/index.d.ts',
			});

			const _pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
				},
			);

			await fs.mkdir(path.join(fixture.path, 'src', 'nested2'));
			await fixture.writeFile('./src/nested2/index.ts', 'export function sayHello2(name: string) { return name; }');

			await fixture.writeJson('package.json', {
				main: './dist/nested2/index.js',
				module: './dist/nested2/index.mjs',
				types: './dist/nested2/index.d.ts',
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
				},
			);

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/nested/index.js')).toBe(true);
			expect(await fixture.exists('dist/nested/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/nested/index.d.ts')).toBe(true);
			expect(await fixture.exists('dist/nested2/index.js')).toBe(true);
			expect(await fixture.exists('dist/nested2/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/nested2/index.d.ts')).toBe(true);
		});

		test('with flag', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				main: './dist/nested/index.js',
				module: './dist/nested/index.mjs',
				types: './dist/nested/index.d.ts',
			});

			const _pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
				},
			);

			await fs.mkdir(path.join(fixture.path, 'src', 'nested2'));
			await fixture.writeFile('./src/nested2/index.ts', 'export function sayHello2(name: string) { return name; }');

			await fixture.writeJson('package.json', {
				main: './dist/nested2/index.js',
				module: './dist/nested2/index.mjs',
				types: './dist/nested2/index.d.ts',
			});

			const pkgrollProcess = await pkgroll(
				['--clean-dist'],
				{
					cwd: fixture.path,
					nodePath,
				},
			);

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/nested/index.js')).toBe(false);
			expect(await fixture.exists('dist/nested/index.mjs')).toBe(false);
			expect(await fixture.exists('dist/nested/index.d.ts')).toBe(false);
			expect(await fixture.exists('dist/nested2/index.js')).toBe(true);
			expect(await fixture.exists('dist/nested2/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/nested2/index.d.ts')).toBe(true);
		});
	});
});
