import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execa } from 'execa';
import outdent from 'outdent';
import { TraceMap, originalPositionFor, type EncodedSourceMap } from '@jridgewell/trace-mapping';
import { pkgroll } from '../../utils.ts';
import {
	packageFixture, createPackageJson, installTypeScript, createTsconfigJson,
} from '../../fixtures.ts';

const readSourceMap = async (filePath: string): Promise<EncodedSourceMap> => {
	const content = await fs.readFile(filePath, 'utf8');
	return JSON.parse(content) as EncodedSourceMap;
};

export const sourcemap = (nodePath: string) => describe('generate sourcemap', () => {
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

	test('dts sourcemap sources paths are relative to chunk directory', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					'.': {
						types: './dist/index.d.ts',
					},
					'./nested': {
						types: './dist/nested/index.d.ts',
					},
				},
			}),
			'tsconfig.json': createTsconfigJson({
				compilerOptions: {
					typeRoots: [
						path.resolve('node_modules/@types'),
					],
				},
			}),
			'src/index.ts': outdent`
				export type RootType = string;
			`,
			'src/nested/index.ts': outdent`
				export type NestedType = number;
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

		// Check root level sourcemap
		expect(await fixture.exists('dist/index.d.ts.map')).toBe(true);
		const rootMap = await readSourceMap(path.join(fixture.path, 'dist/index.d.ts.map'));
		// Sources should be relative to dist/ and point back to src/
		expect(rootMap.sources.some(s => s?.startsWith('../src/'))).toBe(true);

		// Check nested sourcemap
		expect(await fixture.exists('dist/nested/index.d.ts.map')).toBe(true);
		const nestedMap = await readSourceMap(path.join(fixture.path, 'dist/nested/index.d.ts.map'));
		// Sources should be relative to dist/nested/ and point back to src/nested/
		expect(nestedMap.sources.some(s => s?.startsWith('../../src/nested/'))).toBe(true);
	});

	test('dts sourcemap file field is basename only', async () => {
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					'./nested': {
						types: './dist/nested/index.d.ts',
					},
				},
			}),
			'src/nested/index.ts': outdent`
				export type NestedType = number;
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

		expect(await fixture.exists('dist/nested/index.d.ts.map')).toBe(true);
		const nestedMap = await readSourceMap(path.join(fixture.path, 'dist/nested/index.d.ts.map'));

		// The file field should be just the basename, not include the directory
		expect(nestedMap.file).toBe('index.d.ts');
	});

	test('dts sourcemap does not have sourcesContent', async () => {
		// TypeScript's tsserver rejects sourcemaps with sourcesContent
		// https://github.com/microsoft/TypeScript/blob/b19a9da2a3b8f2a720d314d01258dd2bdc110fef/src/services/sourcemaps.ts#L226
		// If present, Go-to-Definition silently fails
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.ts',
				},
			}),
			'src/index.ts': outdent`
				export type User = {
					id: string;
					name: string;
				};
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

		expect(await fixture.exists('dist/index.d.ts.map')).toBe(true);
		const map = await readSourceMap(path.join(fixture.path, 'dist/index.d.ts.map'));

		// Output should NOT have sourcesContent (stripped for TS compatibility)
		expect(map).not.toHaveProperty('sourcesContent');
	});

	test('dts sourcemap chains to original .ts sources', async () => {
		// Verify the sourcemap points to original .ts files, not intermediate .d.ts
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.ts',
				},
			}),
			'src/index.ts': outdent`
				export { User } from './types.js';
			`,
			'src/types.ts': outdent`
				export type User = {
					id: string;
					name: string;
				};
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

		expect(await fixture.exists('dist/index.d.ts.map')).toBe(true);
		const map = await readSourceMap(path.join(fixture.path, 'dist/index.d.ts.map'));

		// Sources should point to .ts files, not .d.ts files
		const hasOriginalSources = map.sources.every(
			s => s?.endsWith('.ts') && !s?.endsWith('.d.ts'),
		);
		expect(hasOriginalSources).toBe(true);

		// Should reference types.ts where User is defined
		const hasTypesSource = map.sources.some(s => s?.includes('types.ts'));
		expect(hasTypesSource).toBe(true);
	});

	test('dts sourcemap has per-identifier mappings for Go-to-Definition', async () => {
		// Verify per-identifier precision, not just per-line
		// Clicking on "id" should map to column > 0 in source
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.ts',
				},
			}),
			'src/index.ts': outdent`
				export type User = {
					id: string;
					name: string;
				};
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

		expect(await fixture.exists('dist/index.d.ts.map')).toBe(true);
		const map = await readSourceMap(path.join(fixture.path, 'dist/index.d.ts.map'));
		const tracer = new TraceMap(map);

		// Read the output to find the column of "id" on line 2
		const output = await fixture.readFile('dist/index.d.ts', 'utf8');
		const lines = output.split('\n');
		const idLine = lines.findIndex(l => l.includes('id:'));

		// Ensure the test fixture is set up correctly
		expect(idLine).not.toBe(-1);

		const idColumn = lines[idLine].indexOf('id');
		const pos = originalPositionFor(tracer, {
			line: idLine + 1, // 1-indexed
			column: idColumn,
		});

		// Should map to a specific column, not just line start (column 0)
		// This verifies per-identifier precision from the hydration algorithm
		expect(pos.column).not.toBeNull();
		expect(pos.column).toBeGreaterThan(0);
	});

	test('dts sourcemap works with .mts input', async () => {
		// Verify sourcemaps work for .mts inputs (ESM TypeScript)
		// The plugin must handle .mts → .d.ts path conversion correctly
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.ts',
				},
			}),
			'src/index.mts': outdent`
				export type Config = {
					debug: boolean;
					timeout: number;
				};
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

		expect(await fixture.exists('dist/index.d.ts.map')).toBe(true);
		const map = await readSourceMap(path.join(fixture.path, 'dist/index.d.ts.map'));

		// Sources should point to original .mts file
		const hasMtsSource = map.sources.some(s => s?.endsWith('.mts'));
		expect(hasMtsSource).toBe(true);

		// Verify per-identifier precision
		const tracer = new TraceMap(map);
		const output = await fixture.readFile('dist/index.d.ts', 'utf8');
		const lines = output.split('\n');
		const debugLine = lines.findIndex(l => l.includes('debug:'));

		// Ensure the test fixture is set up correctly
		expect(debugLine).not.toBe(-1);

		const debugColumn = lines[debugLine].indexOf('debug');
		const pos = originalPositionFor(tracer, {
			line: debugLine + 1,
			column: debugColumn,
		});

		expect(pos.source).toMatch(/\.mts$/);
		expect(pos.column).toBeGreaterThan(0);
	});

	test('dts sourcemap respects declarationMap in tsconfig', async () => {
		// Verify that declarationMap: true in tsconfig enables .d.ts sourcemaps
		// even without --sourcemap flag
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.ts',
					default: './dist/index.js',
				},
			}),
			'tsconfig.json': createTsconfigJson({
				compilerOptions: {
					declarationMap: true,
					typeRoots: [
						path.resolve('node_modules/@types'),
					],
				},
			}),
			'src/index.ts': outdent`
				export type Config = {
					debug: boolean;
				};
				export const defaultConfig: Config = { debug: false };
			`,
		});

		// No --sourcemap flag passed
		const pkgrollProcess = await pkgroll(
			[],
			{
				cwd: fixture.path,
				nodePath,
			},
		);

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// .d.ts sourcemap should exist due to declarationMap: true
		expect(await fixture.exists('dist/index.d.ts.map')).toBe(true);

		// JS sourcemap should NOT exist (no --sourcemap flag)
		expect(await fixture.exists('dist/index.js.map')).toBe(false);

		// Verify the .d.ts sourcemap points to .ts source
		const map = await readSourceMap(path.join(fixture.path, 'dist/index.d.ts.map'));
		expect(map.sources.some(s => s?.endsWith('.ts'))).toBe(true);
	});
});
