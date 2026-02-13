import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execa } from 'execa';
import { outdent } from 'outdent';
import { pkgroll } from '../../utils.ts';
import { createPackageJson } from '../../fixtures.ts';

export const importsAlias = (nodePath: string) => describe('imports - non-# import handling', () => {
	test('non-# imports are skipped', async () => {
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

		const indexExists = await fixture.exists(`${packagePath}/dist/index.js`);
		expect(indexExists).toBe(true);

		const internalExists = await fixture.exists(`${packagePath}/dist/internal.js`);
		expect(internalExists).toBe(false);

		const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
		expect(stdout).toBe('456');
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

		const validExists = await fixture.exists(`${packagePath}/dist/valid.js`);
		expect(validExists).toBe(true);

		const invalidExists = await fixture.exists(`${packagePath}/dist/invalid.js`);
		expect(invalidExists).toBe(false);

		const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
		expect(distContent).toMatch('#valid');

		const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
		expect(stdout).toBe('works');
	});

	test('condition keys (node/default) processed despite not starting with #', async () => {
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

		const nodeExists = await fixture.exists(`${packagePath}/dist/node.js`);
		expect(nodeExists).toBe(true);

		const browserExists = await fixture.exists(`${packagePath}/dist/browser.js`);
		expect(browserExists).toBe(true);

		const distContent = await fixture.readFile(`${packagePath}/dist/index.js`, 'utf8');
		expect(distContent).toMatch('#platform');

		const { stdout } = await execa('node', ['load-pkg.mjs'], { cwd: fixture.path });
		expect(stdout).toBe('node');
	});
});
