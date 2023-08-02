import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('env', ({ test }) => {
		test('dead code elimination via env', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				main: './dist/conditional-require.js',
			});

			const pkgrollProcess = await pkgroll(['--env.NODE_ENV=development'], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/conditional-require.js', 'utf8');
			expect(content).toMatch('development');
			expect(content).not.toMatch('2 ** 3');
		});
	});
});
