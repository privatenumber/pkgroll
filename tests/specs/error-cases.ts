import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../utils.js';
import { packageFixture, createPackageJson } from '../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('Error handling', ({ test }) => {
		test('no package.json', async () => {
			await using fixture = await createFixture(packageFixture());

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
					reject: false,
				},
			);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('package.json not found');
		});

		test('no entry in package.json', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					name: 'pkg',
				}),
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
					reject: false,
				},
			);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('No entry points found');
		});

		test('conflicting entry in package.json', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					name: 'pkg',
					main: 'dist/index.js',
					module: 'dist/index.js',
				}),
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
					reject: false,
				},
			);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('Error: Conflicting export types "commonjs" & "module" found for ./dist/index.js');
		});

		test('ignore and warn on path entry outside of dist directory', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					name: 'pkg',
					main: '/dist/main.js',
				}),
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
					reject: false,
				},
			);

			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('Ignoring file outside of dist directories');
			expect(pkgrollProcess.stderr).toMatch('No entry points found');
		});

		test('cannot find matching source file', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					name: 'pkg',
					main: 'dist/missing.js',
					module: 'dist/missing.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
					reject: false,
				},
			);
			expect(pkgrollProcess.exitCode).toBe(1);
			expect(pkgrollProcess.stderr).toMatch('Source file not found: src/missing(.js|.ts|.tsx|.mts|.cts)');
		});

		test('ignores unexpected extension', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					name: 'pkg',
					exports: {
						'.': './dist/index.js',
						'./styles': './dist/unsupported.css',
					},
				}),
			});

			const pkgrollProcess = await pkgroll(
				[],
				{
					cwd: fixture.path,
					nodePath,
					reject: false,
				},
			);
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toMatch('Unsupported extension (must be .d.ts|.d.mts|.d.cts|.js|.mjs|.cjs)');
		});
	});
});
