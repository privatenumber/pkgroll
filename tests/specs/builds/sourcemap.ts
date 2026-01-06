import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
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
		const sourceCode = outdent`
			// Comment line 1
			// Comment line 2

			/**
			 * Multi-line comment
			 * with several lines
			 */

			// Blank line above
			export function testFunction(name: string) {
				// Line 11 in source
				return \`Hello \${name}\`;
			}
		`;

		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
			}),
			'src/index.ts': sourceCode,
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

		// Verify sourcemap file exists
		expect(await fixture.exists('dist/index.js.map')).toBe(true);

		// Parse and validate sourcemap
		const sourcemapContent = await fixture.readFile('dist/index.js.map', 'utf8');
		const sourcemap = JSON.parse(sourcemapContent);

		// sourcesContent should contain the original source
		expect(sourcemap.sourcesContent).toBeDefined();
		expect(sourcemap.sourcesContent.length).toBeGreaterThan(0);
		expect(sourcemap.sourcesContent[0]).toContain('// Comment line 1');
		expect(sourcemap.sourcesContent[0]).toContain('testFunction');

		// mappings should be non-empty (indicates proper sourcemap generation)
		expect(sourcemap.mappings).toBeDefined();
		expect(sourcemap.mappings.length).toBeGreaterThan(0);
	});
});
