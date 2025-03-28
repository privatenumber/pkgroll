import fs from 'node:fs/promises';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { packageFixture, createPackageJson } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('bin', ({ test }) => {
		test('supports single path', async () => {
			await using fixture = await createFixture({
				// Using a subpath tests that the paths are joined correctly on Windows
				'src/subpath/bin.ts': 'console.log("Hello, world!");',
				'package.json': createPackageJson({
					bin: './dist/subpath/bin.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			await test('is executable', async () => {
				const content = await fixture.readFile('dist/subpath/bin.mjs', 'utf8');
				expect(content).toMatch('#!/usr/bin/env node');

				// File modes don't exist on Windows
				if (process.platform !== 'win32') {
					const stats = await fs.stat(fixture.getPath('dist/subpath/bin.mjs'));
					const unixFilePermissions = `0${(stats.mode & 0o777).toString(8)}`; // eslint-disable-line no-bitwise

					expect(unixFilePermissions).toBe('0755');
				}
			});
		});

		test('supports object', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					bin: {
						a: './dist/index.mjs',
						b: './dist/index.js',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/index.js')).toBe(true);
		});

		test('hashbang gets inserted at the top (despite other injections e.g. createRequire)', async () => {
			await using fixture = await createFixture({
				'src/dynamic-require.ts': 'require((() => \'fs\')());',
				'package.json': createPackageJson({
					bin: './dist/dynamic-require.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dynamic-require.mjs', 'utf8');
			expect(content.startsWith('#!/usr/bin/env node')).toBeTruthy();
		});

		test('publishConfig', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					bin: './dist/invalid.mjs',
					publishConfig: {
						bin: './dist/index.mjs',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/index.mjs')).toBe(true);
		});
	});
});
