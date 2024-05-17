import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('package imports', ({ test }) => {
		test('imports', async () => {
			await using fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				main: './dist/entry.js',
				imports: {
					'~': './src/nested',
				},
			});
			await fixture.writeFile('src/entry.ts', `
				import { sayGoodbye } from '~/utils.js';
				console.log(sayGoodbye);
			`);

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/entry.js', 'utf8');

			expect(content).toMatch('sayGoodbye');
		});
	});
});
