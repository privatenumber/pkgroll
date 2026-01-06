import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execa } from 'execa';
import outdent from 'outdent';
import { pkgroll } from '../../utils.js';
import { packageFixture, createPackageJson } from '../../fixtures.js';

export default testSuite('generate sourcemap', ({ test }, nodePath: string) => {
	test('separate files', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/index.js',
				module: './dist/index.mjs',
			}),
		});

		const pkgrollProcess = await pkgroll(
			['--sourcemap'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/index.js.map')).toBe(true);
		expect(await fixture.exists('dist/index.mjs.map')).toBe(true);
	});

	test('inline sourcemap', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
			}),
		});

		const pkgrollProcess = await pkgroll(
			['--sourcemap=inline'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		expect(
			await fixture.readFile('dist/index.js', 'utf8'),
		).toMatch(/\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,\w+/);
		expect(await fixture.exists('dist/index.js.map')).toBe(false);
	});

	test('preserves line mappings with comments and blank lines', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
			}),
			// Error thrown on line 9 (after comments/blank lines)
			'src/index.ts': outdent`
				// Line 1
				// Line 2
				// Line 3
				// Line 4
				// Line 5
				// Line 6
				// Line 7
				// Line 8
				throw new Error('line 9');
			`,
		});

		const pkgrollProcess = await pkgroll(
			['--sourcemap'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Run with --enable-source-maps and verify stack trace shows correct line
		const { stderr } = await execa('node', ['--enable-source-maps', 'dist/index.js'], {
			cwd: fixture.path,
			reject: false,
		});

		// Stack trace should reference line 9, not line 1
		expect(stderr).toMatch(/index\.ts:9/);
	});
});
