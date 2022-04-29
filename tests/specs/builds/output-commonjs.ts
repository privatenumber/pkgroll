import { testSuite, expect } from 'manten';
import { createFixture } from '../../utils/create-fixture';
import { pkgroll } from '../../utils/pkgroll';

export default testSuite(({ describe }, nodePath: string) => {
	describe('output: commonjs', ({ describe, test }) => {
		test('{ type: commonjs, field: main, distExt: js }', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				main: './dist/index.js',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('module.exports =');

			await fixture.cleanup();
		});

		test('{ type: module, field: main, distExt: cjs }', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				type: 'module',
				main: './dist/index.cjs',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.cjs', 'utf8');
			expect(content).toMatch('module.exports =');

			await fixture.cleanup();
		});

		// src/index.mjs -> dist/index.cjs

		test('nested directory', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			await fixture.writeJson('package.json', {
				main: './dist/nested/index.js',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/nested/index.js', 'utf8');
			expect(content).toMatch('nested entry point');

			await fixture.cleanup();
		});
	});
});
