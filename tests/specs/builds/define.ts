import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { createPackageJson } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('define', ({ test }) => {
		test('dead code elimination', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
				}),
				'src/index.js': `
					if (typeof Iterator.from === 'function') {
						console.log('production');
					} else {
						console.log('development');
					}
				`,
			});

			const pkgrollProcess = await pkgroll([
				'--define.Iterator.from=undefined',
			], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('development');
			expect(content).not.toMatch('production');
		});

		test('values are not automatically stringified', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
				}),
				'src/index.js': `
					const mode = MODE;
					const debug = DEBUG;
					console.log(mode, debug);
				`,
			});

			const pkgrollProcess = await pkgroll([
				'--define.MODE=\'"production"\'',
				'--define.DEBUG=false',
			], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('"production"');
			expect(content).toMatch('false');
		});
	});
});
