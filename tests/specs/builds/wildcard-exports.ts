import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { createPackageJson, installTypeScript } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('wildcard exports', ({ describe }) => {
		describe('single wildcard', ({ test }) => {
			test('basic matching', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'./*': './dist/*.mjs',
							'./utils/*': './dist/utils/*.mjs',
						},
					}),
					'src/alpha.ts': 'export const alpha = "alpha"',
					'src/beta.ts': 'export const beta = "beta"',
					'src/utils/foo.ts': 'export const foo = "foo"',
					'src/utils/bar.ts': 'export const bar = "bar"',
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/alpha.mjs')).toBe(true);
				expect(await fixture.exists('dist/beta.mjs')).toBe(true);
				expect(await fixture.exists('dist/utils/foo.mjs')).toBe(true);
				expect(await fixture.exists('dist/utils/bar.mjs')).toBe(true);

				const fooContent = await fixture.readFile('dist/utils/foo.mjs', 'utf8');
				expect(fooContent).toMatch('foo');
			});

			test('captures include slashes (multi-segment paths)', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'./lib/*': './dist/lib/*.mjs',
						},
					}),
					'src/lib': {
						'single.ts': 'export const single = "single"',
						'utils/string/capitalize.ts': 'export const capitalize = (s: string) => s',
						'deep/nested/path/module.ts': 'export const module = "deep"',
					},
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/lib/single.mjs')).toBe(true);
				expect(await fixture.exists('dist/lib/utils/string/capitalize.mjs')).toBe(true);
				expect(await fixture.exists('dist/lib/deep/nested/path/module.mjs')).toBe(true);
			});

			test('wildcard with suffix', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'./features/*/handler': './dist/features/*/handler.mjs',
						},
					}),
					'src/features': {
						'auth/handler.ts': 'export const auth = "auth"',
						'nested/billing/handler.ts': 'export const billing = "billing"',
					},
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/features/auth/handler.mjs')).toBe(true);
				expect(await fixture.exists('dist/features/nested/billing/handler.mjs')).toBe(true);
			});
		});

		describe('multiple wildcards', ({ test }) => {
			test('all wildcards must match same value', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'./*': './dist/*/*.mjs',
						},
					}),
					'src/foo/foo.ts': 'export const foo = "foo"',
					'src/bar/bar.ts': 'export const bar = "bar"',
					'src/a/b.ts': 'export const baz = "baz"',
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/foo/foo.mjs')).toBe(true);
				expect(await fixture.exists('dist/bar/bar.mjs')).toBe(true);
				// Should not match because 'a' !== 'b'
				expect(await fixture.exists('dist/a/b.mjs')).not.toBe(true);
			});

			test('with interleaved constants', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'./*': './dist/*/_/*/_/*.mjs',
						},
					}),
					'src/foo/_/foo/_/foo.ts': 'export const foo = "foo"',
					'src/bar/_/bar/_/bar.ts': 'export const bar = "bar"',
					'src/a/_/b/_/c.ts': 'export const baz = "baz"',
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/foo/_/foo/_/foo.mjs')).toBe(true);
				expect(await fixture.exists('dist/bar/_/bar/_/bar.mjs')).toBe(true);
				// Should not match because 'a' !== 'b' !== 'c'
				expect(await fixture.exists('dist/a/_/b/_/c.mjs')).not.toBe(true);
			});

			test('capture multi-segment paths', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'./*': './dist/*/*/index.js',
						},
					}),
					'src/a/b/a/b/index.ts': 'export const foo = "foo"',
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/a/b/a/b/index.js')).toBe(true);
			});
		});

		describe('formats & conditions', ({ test }) => {
			test('multiple formats (ESM, CJS, types)', async () => {
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

			test('declaration file extensions (.d.ts, .d.mts, .d.cts)', async () => {
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
					'src/types/models.ts': 'export type Model = { id: string }',
					...installTypeScript,
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/types/models.d.ts')).toBe(true);
				expect(await fixture.exists('dist/types/models.d.mts')).toBe(true);
				expect(await fixture.exists('dist/types/models.d.cts')).toBe(true);
			});

			test('export conditions (node, browser, default)', async () => {
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
						node: { 'fetch.ts': 'export const fetch = () => "node-fetch"' },
						browser: { 'fetch.ts': 'export const fetch = () => "browser-fetch"' },
						default: { 'fetch.ts': 'export const fetch = () => "default-fetch"' },
					},
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/node/fetch.mjs')).toBe(true);
				expect(await fixture.exists('dist/browser/fetch.mjs')).toBe(true);
				expect(await fixture.exists('dist/default/fetch.mjs')).toBe(true);
			});

			test('array of paths', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'./tools/*': [
								'./dist/tools/*.mjs',
								'./dist/tools/*.cjs',
							],
						},
					}),
					'src/tools/logger.ts': 'export const logger = () => "log"',
				});

				const result = await pkgroll([], {
					cwd: fixture.path,
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stderr).toBe('');
				expect(await fixture.exists('dist/tools/logger.mjs')).toBe(true);
				expect(await fixture.exists('dist/tools/logger.cjs')).toBe(true);
			});
		});

		describe('edge cases', ({ test }) => {
			test('no matching files (optional patterns)', async () => {
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

			test('empty capture is rejected', async () => {
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

			test('wildcard without extension emits warning', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'.': './dist/index.mjs',
							'./*': './dist/*',
						},
					}),
					'src/index.ts': 'export const index = "index"',
					'src/foo.ts': 'export const foo = "foo"',
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

			test('mixed static and wildcard exports', async () => {
				await using fixture = await createFixture({
					'package.json': createPackageJson({
						exports: {
							'.': './dist/index.mjs',
							'./utils/*': './dist/utils/*.mjs',
							'./constants': './dist/constants.mjs',
						},
					}),
					'src/index.ts': 'export const main = "main"',
					'src/utils/helper.ts': 'export const helper = "helper"',
					'src/constants.ts': 'export const CONSTANT = "constant"',
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
});
