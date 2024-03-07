import fs from 'fs/promises';
import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('output: commonjs & module', ({ test }) => {
		test('dual', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				exports: {
					'./a': './dist/mjs.cjs',
					'./b': './dist/value.mjs',
				},
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
