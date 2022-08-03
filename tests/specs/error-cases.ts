import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../utils';

export default testSuite(({ describe }, nodePath: string) => {
	describe('Error handling', ({ test }) => {
		test('no package.json', async () => {
			const fixture = await createFixture('./tests/fixture-package');
			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
				},
			).catch(error => error);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('package.json not found');

			await fixture.rm();
		});

		test('invalid package.json', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeFile('package.json', '{ name: pkg }');
			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
				},
			).catch(error => error);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('Cannot parse package.json');

			await fixture.rm();
		});

		test('no entry in package.json', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				name: 'pkg',
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
				},
			).catch(error => error);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('No export entries found in package.json');

			await fixture.rm();
		});

		test('conflicting entry in package.json', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				name: 'pkg',
				main: 'dist/index.js',
				module: 'dist/index.js',
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
				},
			).catch(error => error);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('Error: Conflicting export types "commonjs" & "module" found for ./dist/index.js');

			await fixture.rm();
		});

		test('ignore and warn on path entry outside of dist directory', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				name: 'pkg',
				main: '/dist/main.js',
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
				},
			).catch(error => error);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('Ignoring entry outside of ./dist/ directory: package.json#main="/dist/main.js"');
			expect(pkgrollProcess.stderr).toMatch('No export entries found in package.json');

			await fixture.rm();
		});
	});
});
