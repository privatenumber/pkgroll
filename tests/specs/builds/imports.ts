import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execa } from 'execa';
import { outdent } from 'outdent';
import { pkgroll } from '../../utils.js';
import { createPackageJson, createTsconfigJson, installTypeScript } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('imports as build targets', async ({ test }) => {
		test('basic # import', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#utils': './dist/utils.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					'utils.ts': 'export const helper = () => "util";',
					'index.ts': 'export { helper } from "#utils";',
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { helper } from "test-pkg";
				console.log(helper());
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// Verify dist file contains externalized # import
			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#utils');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('util');
		});

		test('conditional # import', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#env': {
							node: './dist/env-node.js',
							default: './dist/env-browser.js',
						},
					},
					exports: './dist/index.js',
				}),
				src: {
					'env-node.ts': 'export const platform = "node";',
					'env-browser.ts': 'export const platform = "browser";',
					'index.ts': 'export { platform } from "#env";',
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { platform } from "test-pkg";
				console.log(platform);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// Verify dist file contains externalized # import
			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#env');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('node');
		});

		test('non-# import is skipped', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						// @ts-expect-error - Testing non-# import (not spec-compliant but we handle it)
						'my-alias': './src/internal.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					'index.ts': 'export const value = 456;',
					'internal.js': 'export const internal = true;',
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { value } from "test-pkg";
				console.log(value);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// Only exports should be built, not non-# imports
			const indexExists = await fixture.exists(`${packagePath}/dist/index.js`);
			expect(indexExists).toBe(true);

			// internal.js shouldn't be in dist (it's an alias, not a build target)
			const internalExists = await fixture.exists(`${packagePath}/dist/internal.js`);
			expect(internalExists).toBe(false);

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('456');
		});

		test('wildcard # import', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#components/*': './dist/components/*.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					components: {
						'button.ts': 'export const Button = "button";',
						'input.ts': 'export const Input = "input";',
					},
					'index.ts': outdent`
					export { Button } from "#components/button";
					export { Input } from "#components/input";
					`,
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { Button, Input } from "test-pkg";
				console.log(Button + Input);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// Verify dist file contains externalized # imports
			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#components/button');
			expect(distContent).toMatch('#components/input');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('buttoninput');
		});

		test('mixed # and non-# imports - only # are built', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#valid': './dist/valid.js',
						// @ts-expect-error - Testing non-# import (not spec-compliant)
						'invalid-alias': './src/invalid.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					'valid.ts': 'export const valid = "works";',
					'invalid.js': 'export const invalid = "skipped";',
					'index.ts': 'export { valid } from "#valid";',
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { valid } from "test-pkg";
				console.log(valid);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// Valid # import should be built
			const validExists = await fixture.exists(`${packagePath}/dist/valid.js`);
			expect(validExists).toBe(true);

			// Non-# import should not be built
			const invalidExists = await fixture.exists(`${packagePath}/dist/invalid.js`);
			expect(invalidExists).toBe(false);

			// Verify dist file contains externalized # import
			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#valid');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('works');
		});

		test('nested condition keys (node, default) are processed despite not starting with #', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#platform': {
							node: './dist/node.js',
							default: './dist/browser.js',
						},
					},
					exports: './dist/index.js',
				}),
				src: {
					'node.ts': 'export const env = "node";',
					'browser.ts': 'export const env = "browser";',
					'index.ts': 'export { env } from "#platform";',
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { env } from "test-pkg";
				console.log(env);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// Both condition files should be built
			const nodeExists = await fixture.exists(`${packagePath}/dist/node.js`);
			expect(nodeExists).toBe(true);

			const browserExists = await fixture.exists(`${packagePath}/dist/browser.js`);
			expect(browserExists).toBe(true);

			// Verify dist file contains externalized # import
			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#platform');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('node');
		});

		test('types with # imports are externalized', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#utils': './dist/utils.d.ts',
					},
					exports: './dist/index.d.ts',
				}),
				src: {
					'utils.ts': 'export const helper = (): string => "util";',
					'index.ts': 'export { helper } from "#utils";',
				},
				...installTypeScript,
			};

			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				// Consumer TypeScript file that uses the package
				'consumer.ts': outdent`
					import { helper } from "test-pkg";
					const result: string = helper();
				`,
				'tsconfig.json': createTsconfigJson({
					compilerOptions: {
						strict: true,
						module: 'preserve',
					},
				}),
			});

			// Build the package
			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// Verify .d.ts contains externalized # import (not inlined)
			const dtsContent = await fixture.readFile(`${packagePath}/dist/index.d.ts`, 'utf8');
			expect(dtsContent).toMatch('#utils');

			// Type-check the consumer to ensure types resolve correctly
			const typeCheck = await execa('tsc', ['--noEmit'], {
				cwd: fixture.path,
				reject: false,
			});
			expect(typeCheck.exitCode).toBe(0);
		});

		test('monorepo hoisted dependencies - # imports from dependencies are not externalized', async () => {
			// Monorepo structure:
			// packages/my-package/
			// node_modules/hoisted-dep/ (hoisted dependency)
			const packagePath = 'packages/my-package';
			const hoistedDepPath = 'node_modules/hoisted-dep';
			await using fixture = await createFixture({
				[packagePath]: {
					'package.json': createPackageJson({
						name: 'my-package',
						type: 'module',
						imports: {
							'#internal': './dist/internal.js',
						},
						exports: './dist/index.js',
					}),
					src: {
						'internal.ts': 'export const internal = "internal";',
						'index.ts': outdent`
						import { internal } from "#internal";
						import { hoisted } from "hoisted-dep";
						export { internal, hoisted };
						`,
					},
				},
				[hoistedDepPath]: {
					'package.json': createPackageJson({
						name: 'hoisted-dep',
						type: 'module',
						imports: {
							'#dep-internal': './dep-internal.js',
						},
						exports: './index.js',
					}),
					'index.js': 'export { depInternal as hoisted } from "#dep-internal";',
					'dep-internal.js': 'export const depInternal = "hoisted";',
				},
				'load-pkg.mjs': outdent`
				import { internal, hoisted } from "./packages/my-package/dist/index.js";
				console.log(internal + hoisted);
				`,
			});

			// Build the package from packages/my-package
			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// Verify my-package dist contains externalized # import (from own package)
			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#internal');

			// Dependency's # imports should be bundled (not externalized)
			// because hoisted-dep is in node_modules
			expect(distContent).not.toMatch('#dep-internal');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('internalhoisted');
		});

		test('node_modules substring in source path should not prevent # import externalization', async () => {
			// Edge case: source directory name contains "node_modules" substring
			// e.g., src/node_modules/file.ts
			// This should still externalize # imports (it's not a real dependency)
			const packagePath = 'node_modules/test-pkg';
			await using fixture = await createFixture({
				[packagePath]: {
					'package.json': createPackageJson({
						name: 'test-pkg',
						type: 'module',
						imports: {
							'#internal': './dist/node_modules_backup/internal.js',
						},
						exports: './dist/node_modules_backup/index.js',
					}),
					src: {
						node_modules_backup: {
							'helper.ts': 'export const value = "backup";',
							'internal.ts': 'export { value as internal } from "./helper.js";',
							'index.ts': 'export { internal } from "#internal";',
						},
					},
				},
				'load-pkg.mjs': outdent`
				import { internal } from "test-pkg";
				console.log(internal);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// # import should be externalized (importer is from src/, not from node_modules/)
			const distContent = await fixture.readFile(`${packagePath}/dist/node_modules_backup/index.js`, 'utf8');
			expect(distContent).toMatch('#internal');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('backup');
		});
	});
});
