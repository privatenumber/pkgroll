import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import type { SubprocessError } from 'nano-spawn';
import { pkgroll, expectError } from '../../utils.ts';
import { packageFixture, createPackageJson } from '../../fixtures.ts';

export const cleanDist = () => describe('clean dist', () => {
	for (const [destination, contained] of [['src', 'source directory'], ['.', 'working directory']]) {
		test(`refuses to clean ${destination}`, async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({ main: './src/index.js' }),
				'src/index.js': 'export default 1;',
			});
			const result = await pkgroll(['--srcdist', `src:${destination}`, '--clean-dist'], {
				cwd: fixture.path,
			}).catch(error => error as SubprocessError);
			expectError(result);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(`Error: --clean-dist refused to delete "./${destination === '.' ? '' : `${destination}/`}"`);
			expect(result.stderr).toContain(contained);
			expect(await fixture.readFile('src/index.js', 'utf8')).toBe('export default 1;');
		});
	}

	test('checks every destination against every source before cleaning', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({ main: './dist/index.js' }),
			'src/index.js': 'export default 1;',
			'other/index.js': 'export default 2;',
			'dist/keep.js': 'keep',
		});
		const result = await pkgroll(['--srcdist', 'src:dist', '--srcdist', 'other:src', '--clean-dist'], {
			cwd: fixture.path,
		}).catch(error => error as SubprocessError);
		expectError(result);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('source directory');
		expect(await fixture.readFile('src/index.js', 'utf8')).toBe('export default 1;');
		expect(await fixture.readFile('dist/keep.js', 'utf8')).toBe('keep');
	});

	test('refuses a destination that resolves through a symlink to a source directory', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({ main: './src/index.js' }),
			'src/index.js': 'export default 1;',
			alias: ({ fixturePath, symlink }) => symlink(path.join(fixturePath, 'src'), process.platform === 'win32' ? 'junction' : 'dir'),
		});
		const result = await pkgroll(['--srcdist', 'src:alias', '--clean-dist'], {
			cwd: fixture.path,
		}).catch(error => error as SubprocessError);
		expectError(result);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('source directory');
		expect(await fixture.readFile('src/index.js', 'utf8')).toBe('export default 1;');
	});

	test('resolves symlinks before parent segments in destinations', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({ main: './src/index.js' }),
			'src/index.js': 'export default 1;',
			'other/keep.js': 'keep',
			'safe/src/keep.js': 'keep',
			'safe/link': ({ fixturePath, symlink }) => symlink(path.join(fixturePath, 'other'), process.platform === 'win32' ? 'junction' : 'dir'),
		});
		const result = await pkgroll(['--srcdist', 'src:safe/link/../src', '--clean-dist'], {
			cwd: fixture.path,
		}).catch(error => error as SubprocessError);
		expectError(result);
		expect(result.exitCode).toBe(1);

		// Windows path APIs collapse ".." before following junctions, so the destination
		// is "safe/src" there and nothing reaches "src/". POSIX follows the link first.
		if (process.platform === 'win32') {
			expect(result.stderr).toContain('Error: No entry points found');
			expect(await fixture.exists('safe/src/keep.js')).toBe(false);
		} else {
			expect(result.stderr).toContain('--clean-dist refused to delete');
			expect(result.stderr).toContain('source directory');
		}
		expect(await fixture.readFile('src/index.js', 'utf8')).toBe('export default 1;');
	});

	test('protects intermediate source symlinks inside the destination', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({ main: './dist/index.js' }),
			'src/nested/index.js': 'export default 1;',
			'dist/link': ({ fixturePath, symlink }) => symlink(path.join(fixturePath, 'src'), process.platform === 'win32' ? 'junction' : 'dir'),
		});
		const result = await pkgroll(['--srcdist', 'dist/link/nested:dist', '--clean-dist'], {
			cwd: fixture.path,
		}).catch(error => error as SubprocessError);
		expectError(result);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('--clean-dist refused to delete');
		expect(result.stderr).toContain('source directory');
		const sourceLink = await fs.lstat(fixture.getPath('dist/link'));
		expect(sourceLink.isSymbolicLink()).toBe(true);
		expect(await fixture.readFile('src/nested/index.js', 'utf8')).toBe('export default 1;');
	});

	test('protects a source symlink inside the destination', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({ main: './dist/index.js' }),
			'src/index.js': 'export default 1;',
			'dist/src': ({ fixturePath, symlink }) => symlink(path.join(fixturePath, 'src'), process.platform === 'win32' ? 'junction' : 'dir'),
		});
		const result = await pkgroll(['--srcdist', 'dist/src:dist', '--clean-dist'], {
			cwd: fixture.path,
		}).catch(error => error as SubprocessError);
		expectError(result);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('--clean-dist refused to delete');
		expect(result.stderr).toContain('source directory');
		const sourceLink = await fs.lstat(fixture.getPath('dist/src'));
		expect(sourceLink.isSymbolicLink()).toBe(true);
		expect(await fixture.readFile('src/index.js', 'utf8')).toBe('export default 1;');
	});

	test('no flag', async () => {
		await using fixture = await createFixture({
			...packageFixture({ installTypeScript: true }),
			'package.json': createPackageJson({
				main: './dist/nested/index.js',
				module: './dist/nested/index.mjs',
				types: './dist/nested/index.d.ts',
			}),
		});

		await pkgroll(
			[],
			{
				cwd: fixture.path,
			},
		);

		await fs.mkdir(fixture.getPath('src', 'nested2'));
		await fixture.writeFile('./src/nested2/index.ts', 'export function sayHello2(name: string) { return name; }');

		await fixture.writeFile('package.json', createPackageJson({
			main: './dist/nested2/index.js',
			module: './dist/nested2/index.mjs',
			types: './dist/nested2/index.d.ts',
		}));

		const pkgrollProcess = await pkgroll(
			[],
			{
				cwd: fixture.path,
			},
		);

		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/nested/index.js')).toBe(true);
		expect(await fixture.exists('dist/nested/index.mjs')).toBe(true);
		expect(await fixture.exists('dist/nested/index.d.ts')).toBe(true);
		expect(await fixture.exists('dist/nested2/index.js')).toBe(true);
		expect(await fixture.exists('dist/nested2/index.mjs')).toBe(true);
		expect(await fixture.exists('dist/nested2/index.d.ts')).toBe(true);
	});

	test('with flag', async () => {
		await using fixture = await createFixture({
			...packageFixture({ installTypeScript: true }),
			'package.json': createPackageJson({
				main: './dist/nested/index.js',
				module: './dist/nested/index.mjs',
				types: './dist/nested/index.d.ts',
			}),
		});

		await pkgroll(
			[],
			{
				cwd: fixture.path,
			},
		);

		await fs.mkdir(fixture.getPath('src', 'nested2'));
		await fixture.writeFile('./src/nested2/index.ts', 'export function sayHello2(name: string) { return name; }');

		await fixture.writeFile('package.json', createPackageJson({
			main: './dist/nested2/index.js',
			module: './dist/nested2/index.mjs',
			types: './dist/nested2/index.d.ts',
		}));

		const pkgrollProcess = await pkgroll(
			['--clean-dist'],
			{
				cwd: fixture.path,
			},
		);

		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/nested/index.js')).toBe(false);
		expect(await fixture.exists('dist/nested/index.mjs')).toBe(false);
		expect(await fixture.exists('dist/nested/index.d.ts')).toBe(false);
		expect(await fixture.exists('dist/nested2/index.js')).toBe(true);
		expect(await fixture.exists('dist/nested2/index.mjs')).toBe(true);
		expect(await fixture.exists('dist/nested2/index.d.ts')).toBe(true);
	});
});
