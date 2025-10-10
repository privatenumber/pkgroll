import { testSuite, expect } from 'manten';
import { readPackageJson } from '../../../src/utils/read-package-json.js';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { createPackageYaml, packageFixture } from '../../fixtures.js';

export default testSuite(async ({ describe }, nodePath: string) => {
	describe('package.yaml support', ({ test }) => {
		test('reads package.yaml correctly', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.yaml': createPackageYaml({
					name: 'pkgroll-yaml',
					version: '1.2.3',
					main: './dist/index.js',
					description: 'Test package.yaml support',
					keywords: ['yaml', 'test'],
					license: 'MIT',
					author: {
						name: 'Test Author',
						email: 'test@example.com',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const { packageJson, packageJsonPath } = await readPackageJson(fixture.path);
			expect(packageJson.name).toBe('pkgroll-yaml');
			expect(packageJson.version).toBe('1.2.3');
			expect(packageJsonPath.endsWith('package.yaml')).toBe(true);
		});
	});
});
