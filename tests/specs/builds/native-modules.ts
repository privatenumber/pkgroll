import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import { createPackageJson } from '../../fixtures.js';

export default testSuite('native modules', ({ test }, nodePath: string) => {
	test('ESM: copies .node files to natives directory', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.mjs',
			}),
			'src/index.js': `
				import native from './native.node';
				console.log(native);
			`,
			'src/native.node': Buffer.from('dummy native module'),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Check that natives directory was created
		expect(await fixture.exists('dist/natives')).toBe(true);

		// Check that .node file was copied
		const files = await fixture.readdir('dist/natives');
		expect(files.some(file => file.endsWith('.node'))).toBe(true);

		// Check that import was rewritten and uses createRequire for ESM
		const content = await fixture.readFile('dist/index.mjs', 'utf8');
		expect(content).toMatch('./natives');
		expect(content).toMatch('createRequire');
	});

	test('CJS: copies .node files to natives directory', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'commonjs',
				main: './dist/index.cjs',
			}),
			'src/index.js': `
				import native from './native.node';
				console.log(native);
			`,
			'src/native.node': Buffer.from('dummy native module'),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Check that natives directory was created
		expect(await fixture.exists('dist/natives')).toBe(true);

		// Check that .node file was copied
		const files = await fixture.readdir('dist/natives');
		expect(files.some(file => file.endsWith('.node'))).toBe(true);

		// Check that import was transformed to require for CJS
		const content = await fixture.readFile('dist/index.cjs', 'utf8');
		expect(content).toMatch('./natives');
		expect(content).toMatch('require');
		// Should NOT have createRequire in CJS output
		expect(content).not.toMatch('createRequire');
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
			'src-a/native-a.node': Buffer.from('native module a'),
			'src-b/index.js': `
				import native from './native-b.node';
				console.log(native);
			`,
			'src-b/native-b.node': Buffer.from('native module b'),
		});

		const pkgrollProcess = await pkgroll([
			'--srcdist',
			'src-a:dist-a',
			'--srcdist',
			'src-b:dist-b',
		], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		// Should create natives in the first dist directory (like shared chunks)
		expect(await fixture.exists('dist-a/natives')).toBe(true);
		expect(await fixture.exists('dist-b/natives')).toBe(false);

		// Check both .node files were copied to first dist
		const files = await fixture.readdir('dist-a/natives');
		expect(files.length).toBeGreaterThanOrEqual(2);
		expect(files.some(file => file.includes('native-a'))).toBe(true);
		expect(files.some(file => file.includes('native-b'))).toBe(true);
	});
});
