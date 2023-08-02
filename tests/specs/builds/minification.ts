import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('minification', ({ test }) => {
		test('minification', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await fixture.writeJson('package.json', {
				main: './dist/target.js',
			});

			const pkgrollProcess = await pkgroll(['--minify', '--target', 'esnext'], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/target.js', 'utf8');

			// Optional chaining function call
			expect(content).toMatch(/\w\?\.\w\(\)/);

			// Name should be minified
			expect(content).not.toMatch('exports.foo=foo');
		});
	});
});
