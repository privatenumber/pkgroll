import { testSuite, expect } from 'manten';
import { createFixture } from '../../utils/create-fixture';
import { pkgroll } from '../../utils/pkgroll';

export default testSuite(({ describe }, nodePath: string) => {
	describe('minification', ({ test }) => {
		test('minification', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				main: './dist/target.js',
			});

			const pkgrollProcess = await pkgroll(['--minify', '--target', 'esnext'], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/target.js', 'utf8');
			expect(content).toMatch('e?.y()');

			// Name should be minified
			expect(content).not.toMatch('exports.foo=foo');

			await fixture.cleanup();
		});
	});
});
