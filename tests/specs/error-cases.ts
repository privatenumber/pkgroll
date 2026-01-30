import path from 'node:path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll, expectMatchesInOrder } from '../utils.js';
import {
	packageFixture, createPackageJson, installTypeScript, createTsconfigJson,
} from '../fixtures.js';

export default testSuite('Error handling', ({ test }, nodePath: string) => {
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

	test('dts error shows import trace (2 levels)', async () => {
		/**
		 * Tests that .d.ts build errors display import trace for debugging.
		 *
		 * Structure:
		 *   index.ts → broken.ts (imports non-existent file)
		 *
		 * Expected error format (from rollup-plugin-import-trace):
		 *   Error [RollupError]: Could not resolve "./does-not-exist.js" from "src/broken.ts"
		 *
		 *   Import trace:
		 *     /path/to/src/index.ts
		 *     ↳ /path/to/src/broken.ts
		 */
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.ts',
				},
			}),
			'tsconfig.json': createTsconfigJson({
				compilerOptions: {
					typeRoots: [path.resolve('node_modules/@types')],
				},
			}),
			'src/index.ts': 'export { BrokenType } from "./broken.js"',
			// This file imports a local file that doesn't exist, causing a build error
			'src/broken.ts': `
			export { MissingType } from "./does-not-exist.js";
			export type BrokenType = string;
			`,
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
		expectMatchesInOrder(pkgrollProcess.stderr as string, [
			/does-not-exist/,
			/Import trace:\n/,
			/src[/\\]index\.ts\n/,
			/↳.*src[/\\]broken\.ts/,
		]);
	});

	test('dts error shows import trace (3 levels)', async () => {
		/**
		 * Tests deeper import traces show all intermediate files.
		 *
		 * Structure:
		 *   index.ts → utils.ts → deep/broken.ts (imports non-existent file)
		 *
		 * Expected error format (from rollup-plugin-import-trace):
		 *   Build failed
		 *     File: /path/to/src/deep/broken.ts
		 *
		 *   Could not resolve "./missing-file.js" from "src/deep/broken.ts"
		 *
		 *   Import trace:
		 *     /path/to/src/index.ts
		 *     ↳ /path/to/src/utils.ts
		 *     ↳ /path/to/src/deep/broken.ts
		 */
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.ts',
				},
			}),
			'tsconfig.json': createTsconfigJson({
				compilerOptions: {
					typeRoots: [path.resolve('node_modules/@types')],
				},
			}),
			'src/index.ts': 'export { helper } from "./utils.js"',
			'src/utils.ts': 'export { helper } from "./deep/broken.js"',
			// Import a local file that doesn't exist
			'src/deep/broken.ts': 'export { helper } from "./missing-file.js"',
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
		expectMatchesInOrder(pkgrollProcess.stderr as string, [
			/missing-file/,
			/Import trace:\n/,
			/src[/\\]index\.ts\n/,
			/↳.*src[/\\]utils\.ts\n/,
			/↳.*src[/\\]deep[/\\]broken\.ts/,
		]);
	});

	test('dts error without import trace (entry point error)', async () => {
		/**
		 * When the error is in the entry point itself, no import trace is shown
		 * (trace length would be 1, which is just the error file itself).
		 *
		 * Structure:
		 *   index.ts (imports non-existent file directly)
		 */
		await using fixture = await createFixture({
			...installTypeScript,
			'package.json': createPackageJson({
				exports: {
					types: './dist/index.d.ts',
				},
			}),
			// Entry point directly imports a file that doesn't exist
			'src/index.ts': 'export { missing } from "./does-not-exist.js"',
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
		expect(pkgrollProcess.stderr).toMatch(/does-not-exist/);
		// Entry point errors should NOT show import trace (trace length = 1)
		expect(pkgrollProcess.stderr).not.toMatch(/Import trace:/);
	});

	test('js/ts error shows import trace (2 levels)', async () => {
		/**
		 * Tests that JS/TS build errors also display import trace for debugging.
		 * This verifies the import trace feature works beyond .d.ts builds.
		 *
		 * Structure:
		 *   index.js → broken.js (imports non-existent file)
		 */
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				main: './dist/index.js',
			}),
			src: {
				'index.js': 'export { value } from "./broken.js"',
				// This file imports a local file that doesn't exist
				'broken.js': 'export { value } from "./missing-file.js"',
			},
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
		expectMatchesInOrder(pkgrollProcess.stderr as string, [
			/missing-file/,
			/Import trace:\n/,
			/src[/\\]index\.js\n/,
			/↳.*src[/\\]broken\.js/,
		]);
	});
});
