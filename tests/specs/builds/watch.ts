import fs from 'node:fs/promises';
import path from 'node:path';
import { on } from 'node:events';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execaNode } from 'execa';
import { packageFixture, createPackageJson } from '../../fixtures.js';

const pkgrollBinPath = path.resolve('./dist/cli.mjs');

const waitForOutput = async (
	subprocess: ReturnType<typeof execaNode>,
	pattern: string,
	timeout = 15_000,
) => {
	for await (const [data] of on(subprocess.stdout!, 'data', { signal: AbortSignal.timeout(timeout) })) {
		if (data.toString().includes(pattern)) {
			return;
		}
	}
};

export default testSuite('watch', ({ test }, nodePath: string) => {
	test('rebuilds on package.json change', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				exports: './dist/index.js',
			}),
		});

		const watchProcess = execaNode(
			pkgrollBinPath,
			['--watch'],
			{
				cwd: fixture.path,
				env: { NODE_PATH: '' },
				reject: false,
				nodePath,
			},
		);

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

			await waitForOutput(watchProcess, 'package.json changed');
			await waitForOutput(watchProcess, 'Built');

			const utilsContent = await fixture.readFile('dist/utils.mjs', 'utf8');
			expect(utilsContent).toMatch('export');
		} finally {
			watchProcess.kill();
			await watchProcess;
		}
	}, { retry: 3 });
});
