import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import {
	installTypeScript,
	createPackageJson,
} from '../../fixtures.ts';

export const packagejsonFilter = (nodePath: string) => describe('--packagejson filter', () => {
	test('--packagejson=false skips all package.json entries', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				main: './dist/index.js',
				types: './dist/index.d.ts',
			}),
			src: {
				'index.ts': 'export const a = 1;',
			},
		});

		const pkgrollProcess = await pkgroll(
			['--packagejson=false', '-i', 'dist/index.d.ts'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Only the -i entry should be built, not main
		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/index.js')).toBe(false);
	});

	test('*.d.ts matches only type declaration outputs', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					'.': {
						types: './dist/index.d.ts',
						import: './dist/index.mjs',
					},
				},
			}),
			src: {
				'index.ts': 'export const a = 1;',
			},
		});

		const pkgrollProcess = await pkgroll(
			['--packagejson=*.d.ts'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/index.mjs')).toBe(false);
	});

	test('*.mjs matches only ESM outputs', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					'.': {
						types: './dist/index.d.ts',
						import: './dist/index.mjs',
						require: './dist/index.cjs',
					},
				},
			}),
			src: {
				'index.ts': 'export const a = 1;',
			},
		});

		const pkgrollProcess = await pkgroll(
			['--packagejson=*.mjs'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/index.mjs')).toBe(true);
		expect(await fixture.exists('dist/index.d.ts')).toBe(false);
		expect(await fixture.exists('dist/index.cjs')).toBe(false);
	});

	test('multiple glob patterns', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					'.': {
						types: './dist/index.d.ts',
						import: './dist/index.mjs',
						require: './dist/index.cjs',
					},
				},
			}),
			src: {
				'index.ts': 'export const a = 1;',
			},
		});

		const pkgrollProcess = await pkgroll(
			['--packagejson=*.d.ts', '--packagejson=*.mjs'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/index.mjs')).toBe(true);
		expect(await fixture.exists('dist/index.cjs')).toBe(false);
	});

	test('full path glob pattern', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					'.': {
						types: './dist/index.d.ts',
						import: './dist/index.mjs',
					},
					'./utils': {
						types: './dist/utils.d.ts',
						import: './dist/utils.mjs',
					},
				},
			}),
			src: {
				'index.ts': 'export const a = 1;',
				'utils.ts': 'export const b = 2;',
			},
		});

		const pkgrollProcess = await pkgroll(
			['--packagejson=dist/utils.*'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Only utils outputs built
		expect(await fixture.exists('dist/utils.d.ts')).toBe(true);
		expect(await fixture.exists('dist/utils.mjs')).toBe(true);

		// index outputs skipped
		expect(await fixture.exists('dist/index.d.ts')).toBe(false);
		expect(await fixture.exists('dist/index.mjs')).toBe(false);
	});

	test('preserves wildcard expansion errors for filtered-in entries', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					// Malformed wildcard: missing file extension triggers an error
					'./components/*': './dist/components/*',
					'.': {
						types: './dist/index.d.ts',
					},
				},
			}),
			src: {
				'index.ts': 'export const a = 1;',
				components: {
					'button.ts': 'export const Button = "button";',
				},
			},
		});

		// Use a pattern that matches everything — the malformed wildcard error
		// should still surface as a warning, not be silently dropped
		const pkgrollProcess = await pkgroll(
			['--packagejson=dist/**'],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);

		// The wildcard error warning should be preserved
		expect(pkgrollProcess.stderr).toMatch('Wildcard pattern must include a file extension');

		// Valid filtered entry still builds
		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
	});
});
