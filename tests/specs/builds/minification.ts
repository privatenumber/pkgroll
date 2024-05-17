import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { packageFixture } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('minification', ({ test }) => {
		test('minification', async () => {
			await using fixture = await createFixture({
				...packageFixture,
				'package.json': JSON.stringify({
					main: './dist/target.js',
				}),
			});

			const pkgrollProcess = await pkgroll(['--minify', '--target', 'esnext'], {
				cwd: fixture.path,
				nodePath,
			});

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
