import { testSuite, expect } from 'manten';
import { createFixture } from '../../utils/create-fixture';
import { pkgroll } from '../../utils/pkgroll';

export default testSuite(({ test }, nodePath: string) => {
	test('module', async () => {
		const fixture = await createFixture('./tests/fixture-package');

		await fixture.writeJson('package.json', {
			module: './dist/index.js',
		});

		const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		expect(content).toMatch('export { index as default }');

		await fixture.cleanup();
	});

	test('require() works in esm', async () => {
		const fixture = await createFixture('./tests/fixture-package');

		await fixture.writeJson('package.json', {
			main: './dist/require.js',
			module: './dist/require.mjs',
		});

		const pkgrollProcess = await pkgroll(['--minify'], { cwd: fixture.path, nodePath });

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const js = await fixture.readFile('dist/require.js', 'utf8');
		expect(js).not.toMatch('createRequire');

		const mjs = await fixture.readFile('dist/require.mjs', 'utf8');
		expect(mjs).toMatch('createRequire');

		await fixture.cleanup();
	});
});
