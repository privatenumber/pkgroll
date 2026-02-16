import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import outdent from 'outdent';
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
			{ cwd: fixture.path, nodePath },
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Only the -i entry should be built, not main
		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/index.js')).toBe(false);
	});

	test('--packagejson=types only builds types entry', async () => {
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
			['--packagejson=types'],
			{ cwd: fixture.path, nodePath },
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/index.js')).toBe(false);
	});

	test('--packagejson=exports filters to exports only', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				main: './dist/main.js',
				exports: {
					types: './dist/index.d.ts',
					import: './dist/index.mjs',
				},
			}),
			src: {
				'index.ts': 'export const a = 1;',
				'main.ts': 'export const b = 2;',
			},
		});

		const pkgrollProcess = await pkgroll(
			['--packagejson=exports'],
			{ cwd: fixture.path, nodePath },
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Exports entries built
		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/index.mjs')).toBe(true);

		// main entry skipped
		expect(await fixture.exists('dist/main.js')).toBe(false);
	});

	test('--packagejson with quoted segments filters nested exports', async () => {
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
			['--packagejson=exports.".".types'],
			{ cwd: fixture.path, nodePath },
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Only types built
		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/index.mjs')).toBe(false);
	});

	test('multiple --packagejson filters', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				main: './dist/main.js',
				types: './dist/index.d.ts',
				bin: './dist/cli.js',
			}),
			src: {
				'index.ts': 'export const a = 1;',
				'main.ts': 'export const b = 2;',
				'cli.ts': outdent`
				#!/usr/bin/env node
				console.log('hello');
				`,
			},
		});

		const pkgrollProcess = await pkgroll(
			['--packagejson=types', '--packagejson=bin'],
			{ cwd: fixture.path, nodePath },
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// types and bin built
		expect(await fixture.exists('dist/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/cli.js')).toBe(true);

		// main skipped
		expect(await fixture.exists('dist/main.js')).toBe(false);
	});
});
