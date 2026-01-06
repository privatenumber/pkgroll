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
		// Source with comments/blank lines before the actual code
		// The function starts on line 10, return on line 12
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

		expect(await fixture.exists('dist/index.js.map')).toBe(true);

		const sourcemapContent = await fixture.readFile('dist/index.js.map', 'utf8');
		const sourcemap = JSON.parse(sourcemapContent);

		// Decode VLQ mappings to get actual source line numbers
		const vlqChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		const decodeVlq = (str: string) => {
			const results: number[] = [];
			let shift = 0;
			let value = 0;
			for (const char of str) {
				const digit = vlqChars.indexOf(char);
				const cont = digit & 32;
				value += (digit & 31) << shift;
				if (cont) {
					shift += 5;
					continue;
				}
				const neg = value & 1;
				value >>= 1;
				results.push(neg ? -value : value);
				shift = 0;
				value = 0;
			}
			return results;
		};

		// Get first mapping's source line (output line 1 -> source line ?)
		const firstLineSegments = sourcemap.mappings.split(';')[0].split(',');
		let sourceLine = 0;
		for (const segment of firstLineSegments) {
			if (!segment) continue;
			const decoded = decodeVlq(segment);
			if (decoded.length >= 4) {
				sourceLine += decoded[2];
				break;
			}
		}

		// The function is on line 10 (0-indexed: 9), not line 1
		// Without the fix, this would be 0 (pointing to comment on line 1)
		expect(sourceLine).toBeGreaterThanOrEqual(9);
	});
});
