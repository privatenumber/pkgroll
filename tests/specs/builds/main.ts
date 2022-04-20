import { testSuite, expect } from 'manten';
import { createFixture } from '../../utils/create-fixture';
import { pkgroll } from '../../utils/pkgroll';

export default testSuite(({ describe }, nodePath: string) => {
	describe('main', ({ describe, test }) => {
		test('js', async () => {
			const fixture = await createFixture('./tests/fixture-package');

			console.log(fixture.path);
			await fixture.writeJson('package.json', {
				main: './dist/index.js',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			console.log(pkgrollProcess);

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('module.exports =');

			await fixture.cleanup();
		});

		// test('mjs', async () => {
		// 	const fixture = await createFixture('./tests/fixture-package');

		// 	await fixture.writeJson('package.json', {
		// 		main: './dist/index.mjs',
		// 	});

		// 	const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

		// 	expect(pkgrollProcess.exitCode).toBe(0);
		// 	expect(pkgrollProcess.stderr).toBe('');

		// 	const content = await fixture.readFile('dist/index.mjs', 'utf8');
		// 	expect(content).toMatch('export { index as default }');

		// 	await fixture.cleanup();
		// });

		// describe('type module', ({ test }) => {
		// 	test('js', async () => {
		// 		const fixture = await createFixture('./tests/fixture-package');

		// 		await fixture.writeJson('package.json', {
		// 			type: 'module',
		// 			main: './dist/index.js',
		// 		});

		// 		const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

		// 		expect(pkgrollProcess.exitCode).toBe(0);
		// 		expect(pkgrollProcess.stderr).toBe('');

		// 		const content = await fixture.readFile('dist/index.js', 'utf8');
		// 		expect(content).toMatch('export { index as default }');

		// 		await fixture.cleanup();
		// 	});

		// 	test('cjs', async () => {
		// 		const fixture = await createFixture('./tests/fixture-package');

		// 		await fixture.writeJson('package.json', {
		// 			type: 'module',
		// 			main: './dist/index.cjs',
		// 		});

		// 		const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

		// 		expect(pkgrollProcess.exitCode).toBe(0);
		// 		expect(pkgrollProcess.stderr).toBe('');

		// 		const content = await fixture.readFile('dist/index.cjs', 'utf8');
		// 		expect(content).toMatch('module.exports =');

		// 		await fixture.cleanup();
		// 	});
		// });

		// test('nested directory', async () => {
		// 	const fixture = await createFixture('./tests/fixture-package');

		// 	await fixture.writeJson('package.json', {
		// 		main: './dist/nested/index.js',
		// 	});

		// 	const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

		// 	expect(pkgrollProcess.exitCode).toBe(0);
		// 	expect(pkgrollProcess.stderr).toBe('');

		// 	const content = await fixture.readFile('dist/nested/index.js', 'utf8');
		// 	expect(content).toMatch('nested entry point');

		// 	await fixture.cleanup();
		// });
	});
});
