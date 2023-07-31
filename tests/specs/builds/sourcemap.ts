import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('generate sourcemap', ({ test }) => {
		test('separate files', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				main: './dist/index.js',
				module: './dist/index.mjs',
			});

			const pkgrollProcess = await pkgroll(
				['--sourcemap'],
				{ cwd: fixture.path, nodePath },
			);

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/index.js.map')).toBe(true);
			expect(await fixture.exists('dist/index.mjs.map')).toBe(true);

			await fixture.rm();
		});

		test('inline sourcemap', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				type: 'module',
				main: './dist/index.js',
			});

			const pkgrollProcess = await pkgroll(
				['--sourcemap=inline'],
				{ cwd: fixture.path, nodePath },
			);

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(
				await fixture.readFile('dist/index.js', 'utf8'),
			).toMatch(/\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,\w+/);
			expect(await fixture.exists('dist/index.js.map')).toBe(false);

			await fixture.rm();
		});
	});
});
