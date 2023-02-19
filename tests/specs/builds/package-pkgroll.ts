import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils';

export default testSuite(({ describe }, nodePath: string) => {
	describe('package pkgroll', ({ test }) => {
		test('string output', async () => {
			const fixture = await createFixture({
				'package.json': JSON.stringify({
					pkgroll: {
						output: [
							'./dist/index.mjs',
						],
					},
				}),
				'src/index.js': 'export default "hello world"',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('hello world');

			await fixture.rm();
		});

		test('object output', async () => {
			const fixture = await createFixture({
				'package.json': JSON.stringify({
					pkgroll: {
						output: [
							{
								path: './dist/index.mjs',
							},
						],
					},
				}),
				'src/index.js': 'export default "hello world"',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('hello world');

			await fixture.rm();
		});

		test('executable output', async () => {
			const fixture = await createFixture({
				'package.json': JSON.stringify({
					pkgroll: {
						output: [
							{
								path: './dist/index.mjs',
								executable: true,
							},
						],
					},
				}),
				'src/index.js': 'export default "hello world"',
			});

			const pkgrollProcess = await pkgroll([], { cwd: fixture.path, nodePath });

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('#!/usr/bin/env node');
			expect(content).toMatch('hello world');

			await fixture.rm();
		});
	});
});
