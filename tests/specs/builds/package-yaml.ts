import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { createPackageYaml, packageFixture } from '../../fixtures.js';

export default testSuite('package.yaml support', ({ test }, nodePath: string) => {
	test('reads package.yaml correctly', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.yaml': createPackageYaml({
				name: 'pkgroll-yaml',
				main: './dist/index.js',
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		expect(await fixture.exists('dist/index.js')).toBe(true);
	});
});
