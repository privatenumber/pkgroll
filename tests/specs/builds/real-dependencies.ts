import path from 'node:path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import {
	installTypeScript,
	createPackageJson,
} from '../../fixtures.js';

export default testSuite('bundles real dependencies', ({ test }, nodePath: string) => {
	test('type-fest types (a lot of d.ts files)', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				types: './dist/index.d.ts',
				devDependencies: {
					'type-fest': '*',
				},
			}),
			'src/index.ts': 'export type { PackageJson } from "type-fest"',
			'node_modules/type-fest': ({ symlink }) => symlink(path.resolve('node_modules/type-fest'), 'dir'),
			...installTypeScript,
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.d.ts', 'utf8');
		expect(content).toMatch('export { PackageJson }');
	});
});
