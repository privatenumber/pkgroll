import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import { createPackageJson } from '../../fixtures.ts';

export const resolveJsToTs = (nodePath: string) => describe('resolve-js-to-ts', () => {
	test('should not transform bare specifier with wildcard exports', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				main: './dist/index.mjs',
				devDependencies: {
					'dep-wildcard': '*',
				},
			}),

			'src/index.ts': `
				import { value } from 'dep-wildcard/utils.js';
				export { value };
			`,

			'node_modules/dep-wildcard': {
				'package.json': JSON.stringify({
					name: 'dep-wildcard',
					type: 'module',
					exports: {
						'./*.js': './dist/*.js',
						'./*': './dist/*.js',
					},
				}),
				'dist/utils.js': 'export const value = "hello";',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.mjs', 'utf8');
		expect(content).toMatch('hello');
	});
});
