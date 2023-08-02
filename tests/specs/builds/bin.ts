import fs from 'fs/promises';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('bin', ({ test }) => {
		test('supports single path', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				bin: './dist/index.mjs',
				exports: './dist/index.mjs',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			if (process.platform !== 'win32') {
				await test('is executable', async () => {
					const content = await fixture.readFile('dist/index.mjs', 'utf8');
					expect(content).toMatch('#!/usr/bin/env node');

					const stats = await fs.stat(`${fixture.path}/dist/index.mjs`);
					const unixFilePermissions = `0${(stats.mode & 0o777).toString(8)}`; // eslint-disable-line no-bitwise

					expect(unixFilePermissions).toBe('0755');
				});
			}
		});

		test('supports object', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				bin: {
					a: './dist/index.mjs',
					b: './dist/index.js',
				},
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/index.js')).toBe(true);
		});
	});
});
