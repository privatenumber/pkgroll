import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import spawn from 'nano-spawn';
import { packageFixture, createPackageJson } from '../../fixtures.ts';
import { killSubprocess, waitForOutput } from '../../utils.ts';

const pkgrollBinPath = path.resolve('./dist/cli.mjs');

export const watch = (nodePath: string) => describe('watch', () => {
	test('rebuilds on package.json change', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				exports: './dist/index.js',
			}),
		});

		const watchProcess = spawn(nodePath, [pkgrollBinPath, '--watch'], {
			cwd: fixture.path,
			env: { NODE_PATH: '' },
		});

		try {
			await waitForOutput(watchProcess, 'Built');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('module.exports');

			// Add a new export to package.json
			await fs.writeFile(
				path.join(fixture.path, 'package.json'),
				createPackageJson({
					exports: {
						'.': './dist/index.js',
						'./utils': './dist/utils.mjs',
					},
				}),
			);

			await waitForOutput(watchProcess, 'package.json changed', 5000);
			await waitForOutput(watchProcess, 'Built', 5000);

			const utilsContent = await fixture.readFile('dist/utils.mjs', 'utf8');
			expect(utilsContent).toMatch('export');
		} finally {
			await killSubprocess(watchProcess);
		}
	});
});
