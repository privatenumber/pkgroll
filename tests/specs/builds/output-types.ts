import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll, installTypeScript } from '../../utils.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('types', ({ test }) => {
		test('emits', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				types: './dist/utils.d.ts',
			});
			await fixture.writeJson('tsconfig.json', {
				compilerOptions: {
					typeRoots: [
						path.resolve('node_modules/@types'),
					],
				},
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/utils.d.ts', 'utf8');
			expect(content).toMatch('declare function');
		});

		test('{ srcExt: mts, distExt: d.ts }', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				types: './dist/mts.d.ts',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/mts.d.ts', 'utf8');
			expect(content).toMatch('declare function');
		});

		test('{ srcExt: .mts, distExt: d.cts }', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				types: './dist/mts.d.cts',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/mts.d.cts', 'utf8');
			expect(content).toMatch('declare function');
		});

		test('{ srcExt: .mts, distExt: d.mts }', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				types: './dist/mts.d.mts',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/mts.d.mts', 'utf8');
			expect(content).toMatch('declare function');
		});

		test('emits multiple', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				exports: {
					'./utils.js': {
						types: './dist/utils.d.ts',
					},
					'./nested': {
						types: './dist/nested/index.d.ts',
					},
				},
			});

			await fixture.writeJson('tsconfig.json', {
				compilerOptions: {
					typeRoots: [
						path.resolve('node_modules/@types'),
					],
				},
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const utilsDts = await fixture.readFile('dist/utils.d.ts', 'utf8');
			expect(utilsDts).toMatch('declare function');

			const nestedDts = await fixture.readFile('dist/nested/index.d.ts', 'utf8');
			expect(nestedDts).toMatch('declare function sayHello');
		});

		test('emits multiple - same name', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				exports: {
					'./a': {
						types: './dist/utils.d.ts',
					},
					'./b': {
						types: './dist/nested/utils.d.ts',
					},
				},
			});

			await fixture.writeJson('tsconfig.json', {
				compilerOptions: {
					typeRoots: [
						path.resolve('node_modules/@types'),
					],
				},
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const utilsDts = await fixture.readFile('dist/utils.d.ts', 'utf8');
			expect(utilsDts).toMatch('declare function sayHello');

			const nestedDts = await fixture.readFile('dist/nested/utils.d.ts', 'utf8');
			expect(nestedDts).toMatch('declare function sayGoodbye');
		});

		test('emits multiple - different extension', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				exports: {
					require: {
						types: './dist/utils.d.cts',
						default: './dist/utils.cjs',
					},
					import: {
						types: './dist/utils.d.mts',
						default: './dist/utils.mjs',
					},
				},
			});

			await fixture.writeJson('tsconfig.json', {
				compilerOptions: {
					typeRoots: [
						path.resolve('node_modules/@types'),
					],
				},
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const utilsDMts = await fixture.readFile('dist/utils.d.mts', 'utf8');
			expect(utilsDMts).toMatch('declare function sayHello');

			const utilsDCts = await fixture.readFile('dist/utils.d.cts', 'utf8');
			expect(utilsDCts).toMatch('declare function sayHello');
		});

		test('bundles .d.ts', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-package');
			onTestFinish(async () => await fixture.rm());

			await installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				types: './dist/dts.d.ts',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dts.d.ts', 'utf8');
			expect(content).toMatch('declare const');
		});

		test('handles types in composite monorepos correctly', async ({ onTestFinish }) => {
			const fixture = await createFixture('./tests/fixture-monorepo');
			onTestFinish(async () => await fixture.rm());

			await installTypeScript(fixture.path);

			await fixture.writeJson('package.json', {
				workspaces: ['packages/*'],
			});

			await fixture.writeJson('packages/one/package.json', {
				name: '@org/one',
				type: 'module',
				exports: { types: './dist/index.d.mts' },
			});

			const pkgrollOne = await pkgroll([], { cwd: `${fixture.path}/packages/one`, nodePath });
			expect(pkgrollOne.exitCode).toBe(0);
			expect(pkgrollOne.stderr).toBe('');

			const contentOne = await fixture.readFile('packages/one/dist/index.d.mts', 'utf8');
			expect(contentOne).toMatch('export type { Name };');

			await fixture.writeJson('packages/two/package.json', {
				main: './dist/index.mjs',
				type: 'module',
				dependencies: {
					'@org/one': 'workspace:*',
				},
			});

			const pkgrollTwo = await pkgroll([], { cwd: `${fixture.path}/packages/two`, nodePath });
			expect(pkgrollTwo.exitCode).toBe(0);
			expect(pkgrollTwo.stderr).toBe('');

			const contentTwo = await fixture.readFile('packages/two/dist/index.mjs', 'utf8');
			expect(contentTwo).toMatch('export { sayHello };');
		});
	});
});
