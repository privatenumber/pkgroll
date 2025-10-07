import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { packageFixture, createPackageJson } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('env', ({ test }) => {
		test('dead code elimination via env', async () => {
			await using fixture = await createFixture({
				...packageFixture(),
				'package.json': createPackageJson({
					main: './dist/conditional-require.js',
				}),
			});

			const pkgrollProcess = await pkgroll(['--env.NODE_ENV=development', '--env.PROD=false'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/conditional-require.js', 'utf8');
			expect(content).toMatch('development');
			expect(content).not.toMatch('production');
		});

		test('dead code elimination via env in node_modules', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.mjs',
				}),
				'src/index.mjs': 'import "dep"',
				'node_modules/dep': {
					'package.json': createPackageJson({
						main: 'index.js',
					}),
					'index.js': `
					if (
						process.env.NODE_ENV === 'production'
						|| process.env['NODE_ENV'] === 'production'
						|| process.env['PROD'] === 'true'
					) {
						console.log('production');
					} else {
						console.log('development');
					}
					`,
				},
			});

			const pkgrollProcess = await pkgroll(['--env.NODE_ENV=development', '--env.PROD=false'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('development');
			expect(content).not.toMatch('production');
		});
	});
});
