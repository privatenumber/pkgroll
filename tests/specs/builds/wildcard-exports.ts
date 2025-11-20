import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { createPackageJson, installTypeScript } from '../../fixtures.js';

export default testSuite('wildcard exports', ({ describe }, nodePath: string) => {
	describe('directory wildcards', ({ test }) => {
		test('single directory segment', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './dist/*.mjs',
						'./utils/*': './dist/utils/*.mjs',
					},
				}),
				src: {
					'module-a.ts': 'export const a = "a"',
					'module-b.ts': 'export const b = "b"',
					utils: {
						'helper-x.ts': 'export const x = "x"',
						'helper-y.ts': 'export const y = "y"',
					},
				},
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/module-a.mjs')).toBe(true);
			expect(await fixture.exists('dist/module-b.mjs')).toBe(true);
			expect(await fixture.exists('dist/utils/helper-x.mjs')).toBe(true);
			expect(await fixture.exists('dist/utils/helper-y.mjs')).toBe(true);

			const content = await fixture.readFile('dist/utils/helper-x.mjs', 'utf8');
			expect(content).toMatch('x');
		});

		test('nested directory paths', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./lib/*': './dist/lib/*.mjs',
					},
				}),
				'src/lib': {
					'module.ts': 'export const value = "value"',
					'utils/string/format.ts': 'export const format = (s: string) => s',
					'nested/deep/path/index.ts': 'export const deep = "deep"',
				},
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/lib/module.mjs')).toBe(true);
			expect(await fixture.exists('dist/lib/utils/string/format.mjs')).toBe(true);
			expect(await fixture.exists('dist/lib/nested/deep/path/index.mjs')).toBe(true);
		});

		test('path with constant suffix', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./features/*/handler': './dist/features/*/handler.mjs',
					},
				}),
				'src/features': {
					'auth/handler.ts': 'export const auth = "auth"',
					'billing/nested/handler.ts': 'export const billing = "billing"',
				},
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/features/auth/handler.mjs')).toBe(true);
			expect(await fixture.exists('dist/features/billing/nested/handler.mjs')).toBe(true);
		});
	});

	describe('filename wildcards', ({ test }) => {
		test('prefix pattern', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./utils/*': './dist/utils/helper-*.mjs',
					},
				}),
				'src/utils': {
					'helper-foo.ts': 'export const foo = "foo"',
					'helper-bar.ts': 'export const bar = "bar"',
					'ignored.ts': 'export const ignored = "ignored"',
					'nested/helper-deep.ts': 'export const deep = "deep"',
				},
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/utils/helper-foo.mjs')).toBe(true);
			expect(await fixture.exists('dist/utils/helper-bar.mjs')).toBe(true);
			expect(await fixture.exists('dist/utils/nested/helper-deep.mjs')).toBe(true);
			expect(await fixture.exists('dist/utils/ignored.mjs')).toBe(false);
		});

		test('suffix pattern', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./libs/*': './dist/libs/*-lib.mjs',
					},
				}),
				'src/libs': {
					'foo-lib.ts': 'export const foo = "foo"',
					'bar-lib.ts': 'export const bar = "bar"',
					'ignored.ts': 'export const ignored = "ignored"',
				},
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/libs/foo-lib.mjs')).toBe(true);
			expect(await fixture.exists('dist/libs/bar-lib.mjs')).toBe(true);
			expect(await fixture.exists('dist/libs/ignored.mjs')).toBe(false);
		});

		test('prefix and suffix pattern', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./components/*': './dist/components/ui.*.component.mjs',
					},
				}),
				'src/components': {
					'ui.button.component.ts': 'export const Button = "button"',
					'ui.input.component.ts': 'export const Input = "input"',
					'ignored.ts': 'export const ignored = "ignored"',
					'ui.button.ts': 'export const partial = "partial"',
				},
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/components/ui.button.component.mjs')).toBe(true);
			expect(await fixture.exists('dist/components/ui.input.component.mjs')).toBe(true);
			expect(await fixture.exists('dist/components/ignored.mjs')).toBe(false);
			expect(await fixture.exists('dist/components/ui.button.mjs')).toBe(false);
		});
	});

	describe('multiple wildcards', ({ test }) => {
		test('validates repeated path segments', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './dist/*/*.mjs',
					},
				}),
				'src/auth/auth.ts': 'export const auth = "auth"',
				'src/api/api.ts': 'export const api = "api"',
				'src/mismatched/other.ts': 'export const other = "other"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/auth/auth.mjs')).toBe(true);
			expect(await fixture.exists('dist/api/api.mjs')).toBe(true);
			expect(await fixture.exists('dist/mismatched/other.mjs')).toBe(false);
		});

		test('validates with interleaved constants', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './dist/*/_/*/_/*.mjs',
					},
				}),
				'src/a/_/a/_/a.ts': 'export const a = "a"',
				'src/b/_/b/_/b.ts': 'export const b = "b"',
				'src/x/_/y/_/z.ts': 'export const mismatch = "mismatch"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/a/_/a/_/a.mjs')).toBe(true);
			expect(await fixture.exists('dist/b/_/b/_/b.mjs')).toBe(true);
			expect(await fixture.exists('dist/x/_/y/_/z.mjs')).toBe(false);
		});

		test('matches multi-segment paths', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './dist/*/*/index.js',
					},
				}),
				'src/auth/user/auth/user/index.ts': 'export const value = "value"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/auth/user/auth/user/index.js')).toBe(true);
		});
	});

	describe('root-level patterns', ({ test }) => {
		test('default src:dist mapping', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './*.mjs',
					},
				}),
				src: {
					'module-a.ts': 'export const a = "a"',
					'module-b.ts': 'export const b = "b"',
					'utils/nested.ts': 'export const nested = "nested"',
				},
				'ignored.ts': 'export const ignored = "ignored"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/module-a.mjs')).toBe(true);
			expect(await fixture.exists('dist/module-b.mjs')).toBe(true);
			expect(await fixture.exists('dist/utils/nested.mjs')).toBe(true);
			expect(await fixture.exists('dist/ignored.mjs')).toBe(false);
			expect(await fixture.exists('ignored.mjs')).toBe(false);
		});

		test('multiple src:dist pairs', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './*.mjs',
					},
				}),
				'src-a': {
					'module-a.ts': 'export const a = "a"',
					'shared/util.ts': 'export const util = "util"',
				},
				'src-b': {
					'module-b.ts': 'export const b = "b"',
					'shared/helper.ts': 'export const helper = "helper"',
				},
				'ignored.ts': 'export const ignored = "ignored"',
			});

			const result = await pkgroll(['--srcdist', 'src-a:dist-a', '--srcdist', 'src-b:dist-b'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist-a/module-a.mjs')).toBe(true);
			expect(await fixture.exists('dist-a/shared/util.mjs')).toBe(true);
			expect(await fixture.exists('dist-b/module-b.mjs')).toBe(true);
			expect(await fixture.exists('dist-b/shared/helper.mjs')).toBe(true);
			expect(await fixture.exists('dist-a/ignored.mjs')).toBe(false);
			expect(await fixture.exists('ignored.mjs')).toBe(false);
		});

		test('filename prefix+suffix pattern', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './mod.*.plugin.mjs',
					},
				}),
				'src-a': {
					'mod.auth.plugin.ts': 'export const auth = "auth"',
					'ignored.ts': 'export const ignored = "ignored"',
					'utils/mod.logger.plugin.ts': 'export const logger = "logger"',
				},
				'src-b': {
					'mod.api.plugin.ts': 'export const api = "api"',
					'partial.ts': 'export const partial = "partial"',
				},
			});

			const result = await pkgroll(['--srcdist', 'src-a:dist-a', '--srcdist', 'src-b:dist-b'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist-a/mod.auth.plugin.mjs')).toBe(true);
			expect(await fixture.exists('dist-a/utils/mod.logger.plugin.mjs')).toBe(true);
			expect(await fixture.exists('dist-b/mod.api.plugin.mjs')).toBe(true);
			expect(await fixture.exists('dist-a/ignored.mjs')).toBe(false);
			expect(await fixture.exists('dist-b/partial.mjs')).toBe(false);
		});

		test('multiple wildcards with validation', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './x.*.y.*.mjs',
					},
				}),
				'src-a': {
					'x.foo.y.foo.ts': 'export const foo = "foo"',
					'x.bar.y.bar.ts': 'export const bar = "bar"',
				},
				'src-b': {
					'x.y.baz.ts': 'export const partial = "partial"',
					'x.one.y.two.ts': 'export const mismatch = "mismatch"',
				},
			});

			const result = await pkgroll(['--srcdist', 'src-a:dist-a', '--srcdist', 'src-b:dist-b'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist-a/x.foo.y.foo.mjs')).toBe(true);
			expect(await fixture.exists('dist-a/x.bar.y.bar.mjs')).toBe(true);
			expect(await fixture.exists('dist-b/x.y.baz.mjs')).toBe(false);
			expect(await fixture.exists('dist-b/x.one.y.two.mjs')).toBe(false);
		});
	});

	describe('export formats & conditions', ({ test }) => {
		test('multiple formats', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./plugins/*': {
							types: './dist/plugins/*.d.ts',
							import: './dist/plugins/*.mjs',
							require: './dist/plugins/*.cjs',
						},
					},
				}),
				'src/plugins/validator.ts': 'export const validator = (x: string) => x',
				...installTypeScript,
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/plugins/validator.d.ts')).toBe(true);
			expect(await fixture.exists('dist/plugins/validator.mjs')).toBe(true);
			expect(await fixture.exists('dist/plugins/validator.cjs')).toBe(true);
		});

		test('declaration file variants', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./types/*': {
							types: {
								default: './dist/types/*.d.ts',
								import: './dist/types/*.d.mts',
								require: './dist/types/*.d.cts',
							},
						},
					},
				}),
				'src/types/schema.ts': 'export type Schema = { id: string }',
				...installTypeScript,
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/types/schema.d.ts')).toBe(true);
			expect(await fixture.exists('dist/types/schema.d.mts')).toBe(true);
			expect(await fixture.exists('dist/types/schema.d.cts')).toBe(true);
		});

		test('environment conditions', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./adapters/*': {
							node: './dist/node/*.mjs',
							browser: './dist/browser/*.mjs',
							default: './dist/default/*.mjs',
						},
					},
				}),
				src: {
					node: { 'http.ts': 'export const http = () => "node"' },
					browser: { 'http.ts': 'export const http = () => "browser"' },
					default: { 'http.ts': 'export const http = () => "default"' },
				},
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/node/http.mjs')).toBe(true);
			expect(await fixture.exists('dist/browser/http.mjs')).toBe(true);
			expect(await fixture.exists('dist/default/http.mjs')).toBe(true);
		});

		test('array fallback paths', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./utils/*': [
							'./dist/utils/*.mjs',
							'./dist/utils/*.cjs',
						],
					},
				}),
				'src/utils/logger.ts': 'export const logger = () => "log"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/utils/logger.mjs')).toBe(true);
			expect(await fixture.exists('dist/utils/logger.cjs')).toBe(true);
		});
	});

	describe('validation & edge cases', ({ test }) => {
		test('warns on explicit export outside dist', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'.': './dist/index.mjs',
						'./outside': './outside.mjs',
					},
				}),
				'src/index.ts': 'export const index = "index"',
				'outside.ts': 'export const outside = "outside"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toContain('Warning');
			expect(result.stderr).toContain('Ignoring file outside of dist directories');
			expect(result.stderr).toContain('package.json#exports["./outside"]');
			expect(await fixture.exists('dist/index.mjs')).toBe(true);
			expect(await fixture.exists('outside.mjs')).toBe(false);
		});

		test('silently ignores wildcard matches outside dist', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./*': './dist/*.mjs',
					},
				}),
				src: {
					'module-a.ts': 'export const a = "a"',
					'module-b.ts': 'export const b = "b"',
				},
				'outside.ts': 'export const outside = "outside"',
				'ignored.ts': 'export const ignored = "ignored"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/module-a.mjs')).toBe(true);
			expect(await fixture.exists('dist/module-b.mjs')).toBe(true);
			expect(await fixture.exists('dist/outside.mjs')).toBe(false);
			expect(await fixture.exists('dist/ignored.mjs')).toBe(false);
		});

		test('handles missing source files', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'.': './dist/index.mjs',
						'./optional/*': './dist/optional/*.mjs',
					},
				}),
				'src/index.ts': 'export const main = "main"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/optional')).toBe(false);
		});

		test('rejects empty wildcard captures', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'.': './dist/index.mjs',
						'./lib/*': './dist/lib/*.mjs',
					},
				}),
				'src/index.ts': 'export const index = "index"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/lib/.mjs')).toBe(false);
		});

		test('warns on missing file extension', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'.': './dist/index.mjs',
						'./*': './dist/*',
					},
				}),
				'src/index.ts': 'export const index = "index"',
				'src/module.ts': 'export const module = "module"',
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toContain('Wildcard pattern must include a file extension');
			expect(result.stderr).toContain('package.json#exports["./*"]');
			expect(await fixture.exists('dist/index.mjs')).toBe(true);
		});

		test('combines static and wildcard exports', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'.': './dist/index.mjs',
						'./utils/*': './dist/utils/*.mjs',
						'./constants': './dist/constants.mjs',
					},
				}),
				src: {
					'index.ts': 'export const main = "main"',
					'constants.ts': 'export const CONSTANT = "constant"',
					utils: {
						'helper.ts': 'export const helper = "helper"',
					},
				},
			});

			const result = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe('');
			expect(await fixture.exists('dist/index.mjs')).toBe(true);
			expect(await fixture.exists('dist/utils/helper.mjs')).toBe(true);
			expect(await fixture.exists('dist/constants.mjs')).toBe(true);
		});
	});
});
