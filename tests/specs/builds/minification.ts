import { pathToFileURL } from 'node:url';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import { packageFixture, createPackageJson } from '../../fixtures.ts';

export const minification = (nodePath: string) => describe('minification', () => {
	test('minification', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/target.js',
			}),
		});

		const pkgrollProcess = await pkgroll(['--minify', '--target', 'esnext'], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/target.js', 'utf8');

		// Optional chaining function call
		expect(content).toMatch(/\w\?\.\w\(\)/);

		// Name should be minified
		expect(content).not.toMatch('exports.foo=foo');

		// Minification should preserve name
		const { functionName } = await import(pathToFileURL(fixture.getPath('dist/target.js')).toString());
		expect(functionName).toBe('preservesName');
	});
});
