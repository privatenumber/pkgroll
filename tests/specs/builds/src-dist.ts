import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import {
	packageFixture, fixtureFiles, installTypeScript, createPackageJson,
} from '../../fixtures.ts';

export const srcDist = (nodePath: string) => describe('legacy src & dist', () => {
	describe('change src', () => {
		test('nested directory - relative path', async () => {
			const srcPath = 'custom-src/nested/src/';
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/nested/index.js',
					module: './dist/nested/index.mjs',
					types: './dist/nested/index.d.ts',
				}),
				[srcPath]: fixtureFiles,
				...installTypeScript,
			});

			const pkgrollProcess = await pkgroll(
				['--src', srcPath],
				{
					cwd: fixture.path,
					nodePath,
				},
			);
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/nested/index.js')).toBe(true);
			expect(await fixture.exists('dist/nested/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/nested/index.d.ts')).toBe(true);
		});

		test('nested directory - absolute path', async () => {
			const srcPath = 'custom-src/nested/src/';
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/nested/index.js',
					module: './dist/nested/index.mjs',
					types: './dist/nested/index.d.ts',
				}),
				[srcPath]: fixtureFiles,
				...installTypeScript,
			});

			const pkgrollProcess = await pkgroll(
				['--src', fixture.getPath(srcPath)],
				{
					cwd: fixture.path,
					nodePath,
				},
			);

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist/nested/index.js')).toBe(true);
			expect(await fixture.exists('dist/nested/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/nested/index.d.ts')).toBe(true);
		});
	});

	describe('change dist', () => {
		test('nested directory', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					main: './nested/index.js',
					module: './nested/index.mjs',
					types: './nested/index.d.ts',
				}),
			});

			const pkgrollProcess = await pkgroll(['--dist', '.'], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('nested/index.js')).toBe(true);
			expect(await fixture.exists('nested/index.mjs')).toBe(true);
			expect(await fixture.exists('nested/index.d.ts')).toBe(true);
		});
	});

	describe('srcdist flag', () => {
		test('change src and dist', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					main: './nested/index.js',
					module: './nested/index.mjs',
					types: './nested/index.d.ts',
				}),
			});

			const pkgrollProcess = await pkgroll(['--srcdist', 'src:.'], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('nested/index.js')).toBe(true);
			expect(await fixture.exists('nested/index.mjs')).toBe(true);
			expect(await fixture.exists('nested/index.d.ts')).toBe(true);
		});

		test('multiple src and dist', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./a': './dist-a/nested/index.mjs',
						'./b': './dist-b/nested/index.cjs',
					},
				}),
				'src-a': fixtureFiles,
				'src-b': fixtureFiles,
				...installTypeScript,
			});

			const pkgrollProcess = await pkgroll(['--srcdist', 'src-a:dist-a', '--srcdist', 'src-b:dist-b'], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			expect(await fixture.exists('dist-a/nested/index.mjs')).toBe(true);
			expect(await fixture.exists('dist-b/nested/index.cjs')).toBe(true);
		});

		test('multiple src and dist types chunk', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./a': './dist-a/index.d.ts',
						'./b': './dist-b/index.d.ts',
					},
				}),
				'src-a': {
					'index.ts': 'export * from "./chunk.js"; export const a = 1;',
					'chunk.ts': 'export const chunk = 2;',
				},
				'src-b': {
					'index.ts': 'export * from "../src-a/chunk.js"; export const b = 2;',
				},
				...installTypeScript,
			});

			const pkgrollProcess = await pkgroll(['--srcdist', 'src-a:dist-a', '--srcdist', 'src-b:dist-b'], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const distA = await fs.readdir(fixture.getPath('dist-a'));
			distA.sort();
			expect(distA).toStrictEqual([
				'chunk-R5gXnDWm.d.ts',
				'index.d.ts',
			]);

			const distB = await fs.readdir(fixture.getPath('dist-b'));
			distB.sort();
			expect(distB).toStrictEqual([
				'index.d.ts',
			]);
		});

		test('shared chunks go in the first dist directory', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./a': './a/index.mjs',
						'./b': './b/index.mjs',
					},
				}),
				'src/a': {
					'shared.js': 'export const x = 1;',
					'index.js': 'import { x } from "./shared.js";console.log(x)',
				},
				'src/b/index.js': 'import { x } from "../a/shared.js";console.log(x)',
			});

			const pkgrollProcess = await pkgroll(['--srcdist', 'src/a:a', '--srcdist', 'src/b:b'], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const distA = await fs.readdir(path.join(fixture.path, 'a'));
			const distB = await fs.readdir(path.join(fixture.path, 'b'));

			distA.sort();
			distB.sort();

			expect(distA).toStrictEqual(['index.mjs', 'shared-DQJTRHGP.mjs']);
			expect(distB).toStrictEqual(['index.mjs']);
		});
	});
});
