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
				'mjs.mjs',
				'value.cjs',
				'value.mjs',
			]);
		});
	});
});
