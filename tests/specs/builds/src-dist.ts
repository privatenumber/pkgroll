import path from 'path';
import fs from 'fs/promises';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll, installTypeScript } from '../../utils';

export default testSuite(({ describe }, nodePath: string) => {
	describe('change src', ({ test }) => {
		test('nested directory - relative path', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				main: './dist/nested/index.js',
				module: './dist/nested/index.mjs',
				types: './dist/nested/index.d.ts',
			});

			const srcPath = 'custom-src/nested/src/';
			const newSourceDirectoryPath = path.join(fixture.path, srcPath);
			await fs.mkdir(path.dirname(newSourceDirectoryPath), {
				recursive: true,
			});

			await fs.rename(
				path.join(fixture.path, 'src'),
				newSourceDirectoryPath,
			);

			const pkgrollProcess = await pkgroll(
				['--src', srcPath],
				{ cwd: fixture.path, nodePath },
			);
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/nested/index.js')).toBe(true);
			expect(await fixture.exists('dist/nested/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/nested/index.d.ts')).toBe(true);

			await fixture.rm();
		});

		test('nested directory - absolute path', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				main: './dist/nested/index.js',
				module: './dist/nested/index.mjs',
				types: './dist/nested/index.d.ts',
			});

			const newSourceDirectoryPath = path.join(fixture.path, 'custom-src/nested/src/');
			await fs.mkdir(path.dirname(newSourceDirectoryPath), {
				recursive: true,
			});

			await fs.rename(
				path.join(fixture.path, 'src'),
				newSourceDirectoryPath,
			);

			const pkgrollProcess = await pkgroll(
				['--src', newSourceDirectoryPath],
				{ cwd: fixture.path, nodePath },
			);

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/nested/index.js')).toBe(true);
			expect(await fixture.exists('dist/nested/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/nested/index.d.ts')).toBe(true);

			await fixture.rm();
		});
	});

	describe('change dist', ({ test }) => {
		test('nested directory', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				main: './nested/index.js',
				module: './nested/index.mjs',
				types: './nested/index.d.ts',
			});

			const pkgrollProcess = await pkgroll(['--dist', '.'], { cwd: fixture.path, nodePath });
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('nested/index.js')).toBe(true);
			expect(await fixture.exists('nested/index.mjs')).toBe(true);
			expect(await fixture.exists('nested/index.d.ts')).toBe(true);

			await fixture.rm();
		});
	});
});
