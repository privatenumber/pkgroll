import path from 'node:path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import {
	packageFixture,
	installTypeScript,
	createPackageJson,
	createTsconfigJson,
} from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('types', ({ test }) => {
		test('emits', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					types: './dist/utils.d.ts',
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						// Check that it handles different module types
						module: 'NodeNext',
						typeRoots: [
							path.resolve('node_modules/@types'),
						],
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/utils.d.ts', 'utf8');
			expect(content).toMatch('declare function');
		});

		test('{ srcExt: mts, distExt: d.ts }', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					types: './dist/mts.d.ts',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/mts.d.ts', 'utf8');
			expect(content).toMatch('declare function');
		});

		test('{ srcExt: tsx, distExt: d.ts }', async () => {
			await using fixture = await createFixture({
				...packageFixture({
					installTypeScript: true,
					installReact: true,
				}),
				'package.json': createPackageJson({
					types: './dist/component.d.ts',
					peerDependencies: {
						react: '*',
					},
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						jsx: 'react-jsx',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/component.d.ts', 'utf8');
			expect(content).toMatch('import * as react_jsx_runtime from \'react/jsx-runtime\'');
			expect(content).toMatch('declare const Component: () => react_jsx_runtime.JSX.Element');
			expect(content).toMatch('export { Component }');
		});

		test('{ srcExt: tsx, distExt: d.mts }', async () => {
			await using fixture = await createFixture({
				...packageFixture({
					installTypeScript: true,
					installReact: true,
				}),
				'package.json': createPackageJson({
					types: './dist/component.d.mts',
					peerDependencies: {
						react: '*',
					},
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						jsx: 'react-jsx',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/component.d.mts', 'utf8');
			expect(content).toMatch('import * as react_jsx_runtime from \'react/jsx-runtime\'');
			expect(content).toMatch('declare const Component: () => react_jsx_runtime.JSX.Element');
			expect(content).toMatch('export { Component }');
		});

		test('{ srcExt: tsx, distExt: d.cts }', async () => {
			await using fixture = await createFixture({
				...packageFixture({
					installTypeScript: true,
					installReact: true,
				}),
				'package.json': createPackageJson({
					types: './dist/component.d.cts',
					peerDependencies: {
						react: '*',
					},
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						jsx: 'react-jsx',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/component.d.cts', 'utf8');
			expect(content).toMatch('import * as react_jsx_runtime from \'react/jsx-runtime\'');
			expect(content).toMatch('declare const Component: () => react_jsx_runtime.JSX.Element');
			expect(content).toMatch('export { Component }');
		});

		test('{ srcExt: .mts, distExt: d.cts }', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					types: './dist/mts.d.cts',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/mts.d.cts', 'utf8');
			expect(content).toMatch('declare function');
		});

		test('{ srcExt: .mts, distExt: d.mts }', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					types: './dist/mts.d.mts',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/mts.d.mts', 'utf8');
			expect(content).toMatch('declare function');
		});

		test('emits multiple', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					exports: {
						'./utils.js': {
							types: './dist/utils.d.ts',
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
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const utilsDts = await fixture.readFile('dist/utils.d.ts', 'utf8');
			expect(utilsDts).toMatch('declare function');

			const nestedDts = await fixture.readFile('dist/nested/index.d.ts', 'utf8');
			expect(nestedDts).toMatch('declare function sayHello');
		});

		test('emits multiple - same name', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					exports: {
						'./a': {
							types: './dist/utils.d.ts',
						},
						'./b': {
							types: './dist/nested/utils.d.ts',
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
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const utilsDts = await fixture.readFile('dist/utils.d.ts', 'utf8');
			expect(utilsDts).toMatch('declare function sayHello');

			const nestedDts = await fixture.readFile('dist/nested/utils.d.ts', 'utf8');
			expect(nestedDts).toMatch('declare function sayGoodbye');
		});

		test('emits multiple - different extension', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
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
				}),
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						typeRoots: [
							path.resolve('node_modules/@types'),
						],
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const utilsDMts = await fixture.readFile('dist/utils.d.mts', 'utf8');
			expect(utilsDMts).toMatch('declare function sayHello');

			const utilsDCts = await fixture.readFile('dist/utils.d.cts', 'utf8');
			expect(utilsDCts).toMatch('declare function sayHello');
		});

		test('bundles .d.ts', async () => {
			await using fixture = await createFixture({
				...packageFixture({ installTypeScript: true }),
				'package.json': createPackageJson({
					types: './dist/dts.d.ts',
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dts.d.ts', 'utf8');
			expect(content).toMatch('declare const');
		});

		test('composite monorepos', async () => {
			await using fixture = await createFixture({
				...installTypeScript,
				packages: {
					one: {
						'package.json': createPackageJson({
							name: '@org/one',
							exports: {
								types: './dist/index.d.mts',
							},
						}),
						'tsconfig.json': createTsconfigJson({
							compilerOptions: {
								composite: true,
							},
							include: [
								'src/index.mts',
								'src/name.mts',
							],
						}),
						src: {
							'index.mts': 'export { Name } from "./name.mjs";',
							'name.mts': 'export type Name = string;',
						},
					},
					two: {
						'package.json': createPackageJson({
							main: './dist/index.mjs',
							dependencies: {
								'@org/one': 'workspace:*',
							},
						}),
						'tsconfig.json': createTsconfigJson({
							compilerOptions: {
								composite: true,
							},
							include: ['src/index.mts'],
							references: [{ path: '../one' }],
						}),
						'src/index.mts': `
						import { Name } from '@org/one';
						export function sayHello(name: Name) {
							console.log('Hello', name);
						}
						`,
					},
				},
				'tsconfig.json': createTsconfigJson({
					references: [
						{ path: './packages/one' },
						{ path: './packages/two' },
					],
				}),
				'package.json': createPackageJson({
					workspaces: ['packages/*'],
				}),
			});

			const pkgrollOne = await pkgroll([], {
				cwd: `${fixture.path}/packages/one`,
				nodePath,
			});
			expect(pkgrollOne.exitCode).toBe(0);
			expect(pkgrollOne.stderr).toBe('');

			const contentOne = await fixture.readFile('packages/one/dist/index.d.mts', 'utf8');
			expect(contentOne).toMatch('export type { Name };');

			const pkgrollTwo = await pkgroll([], {
				cwd: `${fixture.path}/packages/two`,
				nodePath,
			});
			expect(pkgrollTwo.exitCode).toBe(0);
			expect(pkgrollTwo.stderr).toBe('');

			const contentTwo = await fixture.readFile('packages/two/dist/index.mjs', 'utf8');
			expect(contentTwo).toMatch('export { sayHello };');
		});

		test('symlinks', async () => {
			await using fixture = await createFixture({
				...installTypeScript,
				'package.json': createPackageJson({
					types: './dist/index.d.ts',
					peerDependencies: {
						'dep-a': '*',
					},
				}),
				'src/index.ts': `
				import { fn } from 'dep-a';
				export default fn({ value: 1 });
				`,
				node_modules: {
					'dep-a/index.d.ts': ({ symlink }) => symlink('../../store/dep-a/index.d.ts'),
				},
				store: {
					'dep-a': {
						'node_modules/dep-b/index.d.ts': `
						type data = {
							value: number;
						};
						export declare function fn(a: data): data;
						`,
						'index.d.ts': 'export * from \'dep-b\';',
					},
				},
			});

			const pkgrollOne = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollOne.stderr).toBe('');

			const types = await fixture.readFile('dist/index.d.ts', 'utf8');
			expect(types).toMatch('\'dep-a\'');
			expect(types).toMatch('.data');
		});

		test('custom tsconfig.json path', async () => {
			await using fixture = await createFixture({
				...packageFixture({
					installTypeScript: true,
					installReact: true,
				}),
				'package.json': createPackageJson({
					types: './dist/component.d.ts',
					peerDependencies: {
						react: '*',
					},
				}),
				'tsconfig.custom.json': createTsconfigJson({
					compilerOptions: {
						jsx: 'react-jsx',
					},
				}),
			});

			const pkgrollProcess = await pkgroll(['-p', 'tsconfig.custom.json'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/component.d.ts', 'utf8');
			expect(content).toMatch('declare const Component: () => react_jsx_runtime.JSX.Element');
			expect(content).toMatch('export { Component }');
		});
	});
});
