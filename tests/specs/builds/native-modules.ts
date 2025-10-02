import fs from 'node:fs/promises';
import path from 'node:path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { createPackageJson } from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('native modules', ({ test }) => {
		test('copies .node files to natives directory', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
				}),
				'src/index.js': `
					import native from './native.node';
					console.log(native);
				`,
			});

			// Create a dummy .node file after fixture is created
			await fs.writeFile(
				path.join(fixture.path, 'src/native.node'),
				Buffer.from('dummy native module'),
			);

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			// Check that natives directory was created
			const nativesExists = await fs.access(path.join(fixture.path, 'dist/natives'))
				.then(() => true)
				.catch(() => false);
			expect(nativesExists).toBe(true);

			// Check that .node file was copied
			const files = await fs.readdir(path.join(fixture.path, 'dist/natives'));
			expect(files.some(file => file.endsWith('.node'))).toBe(true);

			// Check that import was rewritten
			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('./natives');
		});

		test('handles multiple src:dist pairs', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					exports: {
						'./a': './dist-a/index.js',
						'./b': './dist-b/index.js',
					},
				}),
				'src-a/index.js': `
					import native from './native-a.node';
					console.log(native);
				`,
				'src-b/index.js': `
					import native from './native-b.node';
					console.log(native);
				`,
			});

			// Create dummy .node files
			await fs.mkdir(path.join(fixture.path, 'src-a'), { recursive: true });
			await fs.mkdir(path.join(fixture.path, 'src-b'), { recursive: true });
			await fs.writeFile(
				path.join(fixture.path, 'src-a/native-a.node'),
				Buffer.from('native module a'),
			);
			await fs.writeFile(
				path.join(fixture.path, 'src-b/native-b.node'),
				Buffer.from('native module b'),
			);

			const pkgrollProcess = await pkgroll([
				'--srcdist', 'src-a:dist-a',
				'--srcdist', 'src-b:dist-b',
			], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			// Should create natives at common dist directory
			const nativesPath = path.join(fixture.path, 'natives');
			const nativesExists = await fs.access(nativesPath)
				.then(() => true)
				.catch(() => false);
			expect(nativesExists).toBe(true);

			// Check both .node files were copied
			const files = await fs.readdir(nativesPath);
			expect(files.length).toBeGreaterThanOrEqual(2);
		});
	});
});
