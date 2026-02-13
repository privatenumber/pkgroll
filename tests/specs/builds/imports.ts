import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execa } from 'execa';
import { outdent } from 'outdent';
import { pkgroll } from '../../utils.js';
import { createPackageJson, createTsconfigJson, installTypeScript } from '../../fixtures.js';

export default testSuite('imports as build targets', async ({ describe }, nodePath: string) => {
	describe('basic imports', ({ test }) => {
		test('simple # import', async () => {
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

			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#utils');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('util');
		});

		test('conditional # import (node/default)', async () => {
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

			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#env');

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

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			const dtsContent = await fixture.readFile(`${packagePath}/dist/index.d.ts`, 'utf8');
			expect(dtsContent).toMatch('#utils');

			const typeCheck = await execa('tsc', ['--noEmit'], {
				cwd: fixture.path,
				reject: false,
			});
			expect(typeCheck.exitCode).toBe(0);
		});
	});

	describe('wildcard imports - directory patterns', ({ test }) => {
		test('simple directory wildcard', async () => {
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

			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#components/button');
			expect(distContent).toMatch('#components/input');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('buttoninput');
		});

		test('root-level wildcard', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#./*': './*.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					'helper-a.ts': 'export const helperA = "a";',
					'helper-b.ts': 'export const helperB = "b";',
					'index.ts': outdent`
				export { helperA } from "#./dist/helper-a";
				export { helperB } from "#./dist/helper-b";
				`,
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
			import { helperA, helperB } from "test-pkg";
			console.log(helperA + helperB);
			`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toContain('');

			expect(await fixture.exists(`${packagePath}/dist/index.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/helper-a.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/helper-b.js`)).toBe(true);

			const indexContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(indexContent).toMatch('#./dist/helper-a');
			expect(indexContent).toMatch('#./dist/helper-b');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('ab');
		});

		test('nested directory paths', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#lib/*': './dist/lib/*.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					lib: {
						'module.ts': 'export const value = "value";',
						'utils/string/format.ts': 'export const format = (s: string) => s;',
						'nested/deep/path/index.ts': 'export const deep = "deep";',
					},
					'index.ts': outdent`
					export { value } from "#lib/module";
					export { format } from "#lib/utils/string/format";
					export { deep } from "#lib/nested/deep/path/index";
					`,
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { value, format, deep } from "test-pkg";
				console.log(value + format("test") + deep);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			expect(await fixture.exists(`${packagePath}/dist/lib/module.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/lib/utils/string/format.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/lib/nested/deep/path/index.js`)).toBe(true);

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('valuetestdeep');
		});

		test('path with constant suffix', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#features/*/handler': './dist/features/*/handler.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					features: {
						'auth/handler.ts': 'export const auth = "auth";',
						'billing/nested/handler.ts': 'export const billing = "billing";',
					},
					'index.ts': outdent`
					export { auth } from "#features/auth/handler";
					export { billing } from "#features/billing/nested/handler";
					`,
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { auth, billing } from "test-pkg";
				console.log(auth + billing);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			expect(await fixture.exists(`${packagePath}/dist/features/auth/handler.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/features/billing/nested/handler.js`)).toBe(true);

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('authbilling');
		});
	});

	describe('wildcard imports - filename patterns', ({ test }) => {
		test('filename prefix', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#utils/*': './dist/utils/helper-*.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					utils: {
						'helper-foo.ts': 'export const foo = "foo";',
						'helper-bar.ts': 'export const bar = "bar";',
						'ignored.ts': 'export const ignored = "ignored";',
					},
					'index.ts': outdent`
					export { foo } from "#utils/foo";
					export { bar } from "#utils/bar";
					`,
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { foo, bar } from "test-pkg";
				console.log(foo + bar);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			expect(await fixture.exists(`${packagePath}/dist/utils/helper-foo.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/utils/helper-bar.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/utils/ignored.js`)).toBe(false);

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('foobar');
		});

		test('filename suffix', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#libs/*': './dist/libs/*-lib.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					libs: {
						'foo-lib.ts': 'export const foo = "foo";',
						'bar-lib.ts': 'export const bar = "bar";',
						'ignored.ts': 'export const ignored = "ignored";',
					},
					'index.ts': outdent`
					export { foo } from "#libs/foo";
					export { bar } from "#libs/bar";
					`,
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { foo, bar } from "test-pkg";
				console.log(foo + bar);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			expect(await fixture.exists(`${packagePath}/dist/libs/foo-lib.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/libs/bar-lib.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/libs/ignored.js`)).toBe(false);

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('foobar');
		});

		test('filename prefix and suffix', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#components/*': './dist/components/ui.*.component.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					components: {
						'ui.button.component.ts': 'export const Button = "button";',
						'ui.input.component.ts': 'export const Input = "input";',
						'ignored.ts': 'export const ignored = "ignored";',
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

			expect(await fixture.exists(`${packagePath}/dist/components/ui.button.component.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/components/ui.input.component.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/components/ignored.js`)).toBe(false);

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('buttoninput');
		});
	});

	describe('wildcard imports - multiple wildcards', ({ test }) => {
		test('validates all wildcards capture same value', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					imports: {
						'#features/*': './dist/*/*/handler.js',
					},
					exports: './dist/index.js',
				}),
				src: {
					'auth/auth/handler.ts': 'export const auth = "auth";',
					'api/api/handler.ts': 'export const api = "api";',
					'mismatched/other/handler.ts': 'export const other = "other";',
					'index.ts': outdent`
					export { auth } from "#features/auth";
					export { api } from "#features/api";
					`,
				},
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
				import { auth, api } from "test-pkg";
				console.log(auth + api);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			expect(await fixture.exists(`${packagePath}/dist/auth/auth/handler.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/api/api/handler.js`)).toBe(true);
			expect(await fixture.exists(`${packagePath}/dist/mismatched/other/handler.js`)).toBe(false);

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('authapi');
		});
	});

	describe('edge cases', ({ test }) => {
		test('top-level await with CJS # import should not fail', async () => {
			const packagePath = 'node_modules/test-pkg';
			const consumedPackage = {
				'package.json': createPackageJson({
					name: 'test-pkg',
					type: 'module',
					exports: {
						types: './dist/index.d.mts',
						default: './dist/index.mjs',
					},
					imports: {
						'#helper': {
							default: './dist/helper.cjs',
						},
					},
				}),
				src: {
					'helper.cjs': 'module.exports = { hello: "world" };',
					'index.ts': outdent`
						import { fileURLToPath } from 'node:url';

						const helperPath = fileURLToPath(import.meta.resolve('#helper'));

						const mod = process.env.SOME_CONDITION
							? undefined
							: await import('node:fs');

						export const result = mod?.existsSync(helperPath);
					`,
				},
				...installTypeScript,
			};
			await using fixture = await createFixture({
				[packagePath]: consumedPackage,
				'load-pkg.mjs': outdent`
					import { result } from "test-pkg";
					console.log(result);
				`,
			});

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');

			// ESM output should exist and contain top-level await
			const distContent = await fixture.readFile(`${packagePath}/dist/index.mjs`, 'utf8');
			expect(distContent).toMatch('await');

			// CJS helper should exist
			expect(await fixture.exists(`${packagePath}/dist/helper.cjs`)).toBe(true);

			// Runtime execution should work
			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('true');
		});

		test('monorepo: hoisted dependencies - # imports from dependencies are bundled', async () => {
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

			const result = await pkgroll([], {
				cwd: fixture.getPath(packagePath),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toMatch(/^"hoisted-dep" imported by ".*\/packages\/my-package\/src\/index\.ts" but not declared in package\.json\. Will be bundled to prevent failure at runtime\.$/);

			const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
			expect(distContent).toMatch('#internal');
			expect(distContent).not.toMatch('#dep-internal');
			expect(distContent).not.toMatch('hoisted-dep');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('internalhoisted');
		});

		test('node_modules substring in path should not prevent # import externalization', async () => {
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

			const distContent = await fixture.readFile(`${packagePath}/dist/node_modules_backup/index.js`, 'utf8');
			expect(distContent).toMatch('#internal');

			const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
			expect(stdout).toBe('backup');
		});
	});
});
