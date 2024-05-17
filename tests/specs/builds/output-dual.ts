import fs from 'fs/promises';
import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { packageFixture } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('output: commonjs & module', ({ test }) => {
		test('dual', async () => {
			await using fixture = await createFixture({
				...packageFixture,
				'package.json': JSON.stringify({
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

			const files = await fs.readdir(path.join(fixture.path, 'dist'));
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
