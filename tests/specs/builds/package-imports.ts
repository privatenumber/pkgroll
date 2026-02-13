import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import outdent from 'outdent';
import { pkgroll } from '../../utils.ts';
import { packageFixture, createPackageJson } from '../../fixtures.ts';

export const packageImports = (nodePath: string) => describe('package imports', () => {
	test('imports', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				main: './dist/entry.js',
				imports: {
					// @ts-expect-error Invalid subpath import
					'~': './src/nested',
				},
			}),
			'src/entry.ts': outdent`
				import { sayGoodbye } from '~/utils.js';
				console.log(sayGoodbye);
				`,
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/entry.js', 'utf8');
		expect(content).toMatch('sayGoodbye');
	});
});
