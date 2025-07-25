import fs from 'node:fs/promises';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { packageFixture, createPackageJson } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('output: commonjs & module', ({ test }) => {
		test('dual', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					exports: {
						'./a': './dist/mjs.cjs',
						'./b': './dist/value.mjs',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const files = await fs.readdir(fixture.getPath('dist'));
			files.sort();
			expect(files).toStrictEqual([
				'mjs.cjs',
				'value.mjs',
			]);
		});

		test('no unnecessary chunks', async () => {
			await using fixture = await createFixture({
				src: {
					'index-a.js': 'import("./chunk-a.js")',
					'chunk-a.js': 'console.log(1)',

					'index-b.js': 'import("./chunk-b.js")',
					'chunk-b.js': 'console.log(1)',

					'index-c.js': 'import("./chunk-b.js")',
				},
				'package.json': createPackageJson({
					exports: {
						'./a': './dist/index-a.cjs',
						'./b': './dist/index-b.mjs',
						'./c': './dist/index-c.cjs',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const files = await fs.readdir(fixture.getPath('dist'));
			files.sort();

			expect(files).toStrictEqual([
				'chunk-a-BeOsALY6.cjs',
				'chunk-b-BeOsALY6.cjs',
				'chunk-b-BrZXlwf9.mjs',
				'index-a.cjs',
				'index-b.mjs',
				'index-c.cjs',
			]);
		});
	});
});
