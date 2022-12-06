import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils';

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

			const sourcemap = (await fixture.readFile('dist/index.js', 'utf8') as string)
				.trim()
				.split('\n')
				.at(-1);

			expect(sourcemap?.length).toBeGreaterThan(100);
			expect(await fixture.exists('dist/index.js.map')).toBe(false);

			await fixture.rm();
		});
	});
});
