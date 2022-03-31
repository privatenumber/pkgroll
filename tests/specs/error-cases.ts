import { testSuite, expect } from 'manten';
import { createFixture } from '../utils/create-fixture';
import { pkgroll } from '../utils/pkgroll';

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

			await fixture.cleanup();
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

			await fixture.cleanup();
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

			await fixture.cleanup();
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

			await fixture.cleanup();
		});

		test('absolute path entry in package.json', async () => {
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
			expect(pkgrollProcess.stderr).toMatch('is not in directory ./dist');

			await fixture.cleanup();
		});
	});
});
