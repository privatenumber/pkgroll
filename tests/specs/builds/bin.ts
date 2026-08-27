import fs from 'node:fs/promises';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import outdent from 'outdent';
import { pkgroll } from '../../utils.ts';
import { packageFixture, createPackageJson } from '../../fixtures.ts';

export const bin = (nodePath: string) => describe('bin', () => {
	test('supports single path', async () => {
		await using fixture = await createFixture({
			src: {
				// Using a subpath tests that the paths are joined correctly on Windows
				'subpath/bin.ts': 'console.log("Hello, world!");',
				'random-file.ts': 'console.log("Fix #126");',
			},
			'package.json': createPackageJson({
				bin: './dist/subpath/bin.mjs',
				main: './dist/random-file.mjs',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.stderr).toBe('');

		await test('is executable', async () => {
			const content = await fixture.readFile('dist/subpath/bin.mjs', 'utf8');
			expect(content).toMatch('#!/usr/bin/env node');

			// File modes don't exist on Windows
			if (process.platform !== 'win32') {
				const stats = await fs.stat(fixture.getPath('dist/subpath/bin.mjs'));
				const unixFilePermissions = `0${(stats.mode & 0o777).toString(8)}`; // eslint-disable-line no-bitwise

				expect(unixFilePermissions).toBe('0755');
			}
		});
	});

	test('supports object', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				bin: {
					a: './dist/index.mjs',
					b: './dist/index.js',
				},
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/index.mjs')).toBe(true);
		expect(await fixture.exists('dist/index.js')).toBe(true);
	});

	test('hashbang gets inserted at the top (despite other injections e.g. createRequire)', async () => {
		await using fixture = await createFixture({
			'src/dynamic-require.ts': 'require((() => \'fs\')());',
			'package.json': createPackageJson({
				bin: './dist/dynamic-require.mjs',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/dynamic-require.mjs', 'utf8');
		expect(content.startsWith('#!/usr/bin/env node')).toBeTruthy();
	});

	test('publishConfig', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				bin: './dist/invalid.mjs',
				publishConfig: {
					bin: './dist/index.mjs',
				},
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/index.mjs')).toBe(true);
	});

	describe('source hashbang', () => {
		test('preserves bun hashbang from entry source', async () => {
			await using fixture = await createFixture({
				'src/cli.ts': outdent`
				#!/usr/bin/env bun
				console.log("Hello from bun!");
				`,
				'package.json': createPackageJson({
					bin: './dist/cli.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/cli.mjs', 'utf8');
			expect(content.startsWith('#!/usr/bin/env bun\n')).toBeTruthy();
			// No leftover node hashbang
			expect(content).not.toMatch('#!/usr/bin/env node');
		});

		test('preserves env -S flags from entry source', async () => {
			await using fixture = await createFixture({
				'src/cli.ts': outdent`
				#!/usr/bin/env -S node --no-warnings
				console.log("Hello!");
				`,
				'package.json': createPackageJson({
					bin: './dist/cli.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/cli.mjs', 'utf8');
			expect(content.startsWith('#!/usr/bin/env -S node --no-warnings\n')).toBeTruthy();
		});

		test('falls back to node default when entry has no hashbang', async () => {
			await using fixture = await createFixture({
				'src/cli.ts': 'console.log("No hashbang here");',
				'package.json': createPackageJson({
					bin: './dist/cli.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/cli.mjs', 'utf8');
			expect(content.startsWith('#!/usr/bin/env node\n')).toBeTruthy();
		});

		test('mixed runtimes across multiple bins', async () => {
			await using fixture = await createFixture({
				src: {
					'node-bin.ts': outdent`
					#!/usr/bin/env node
					console.log("node bin");
					`,
					'bun-bin.ts': outdent`
					#!/usr/bin/env bun
					console.log("bun bin");
					`,
					'default-bin.ts': 'console.log("no hashbang");',
				},
				'package.json': createPackageJson({
					bin: {
						'node-bin': './dist/node-bin.mjs',
						'bun-bin': './dist/bun-bin.mjs',
						'default-bin': './dist/default-bin.mjs',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.stderr).toBe('');

			const node = await fixture.readFile('dist/node-bin.mjs', 'utf8');
			expect(node.startsWith('#!/usr/bin/env node\n')).toBeTruthy();

			const bun = await fixture.readFile('dist/bun-bin.mjs', 'utf8');
			expect(bun.startsWith('#!/usr/bin/env bun\n')).toBeTruthy();

			const fallback = await fixture.readFile('dist/default-bin.mjs', 'utf8');
			expect(fallback.startsWith('#!/usr/bin/env node\n')).toBeTruthy();
		});

		test('hashbangs in imported (non-entry) modules are still stripped', async () => {
			await using fixture = await createFixture({
				src: {
					'cli.ts': outdent`
					#!/usr/bin/env bun
					import { run } from './lib.ts';
					run();
					`,
					'lib.ts': outdent`
					#!/usr/bin/env node
					export function run() { console.log("ran"); }
					`,
				},
				'package.json': createPackageJson({
					bin: './dist/cli.mjs',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/cli.mjs', 'utf8');
			// Only the entry's hashbang survives, at the top
			expect(content.startsWith('#!/usr/bin/env bun\n')).toBeTruthy();
			// The imported module's hashbang is stripped (no second hashbang anywhere)
			expect(content.match(/#!/g)).toHaveLength(1);
		});
	});
});
