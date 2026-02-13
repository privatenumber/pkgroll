import path from 'node:path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import {
	installTypeScript,
	createPackageJson,
} from '../../fixtures.ts';

export const realDependencies = (nodePath: string) => describe('bundles real dependencies', () => {
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
