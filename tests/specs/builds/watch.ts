import fs from 'node:fs/promises';
import path from 'node:path';
import { on } from 'node:events';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execaNode } from 'execa';
import { packageFixture, createPackageJson } from '../../fixtures.js';

const pkgrollBinPath = path.resolve('./dist/cli.mjs');

const debug = (...args: unknown[]) => console.error('[watch-debug]', Date.now(), ...args);

const waitForOutput = async (
	subprocess: ReturnType<typeof execaNode>,
	pattern: string,
	timeout = 15_000,
) => {
	debug(`waitForOutput: waiting for "${pattern}" (timeout: ${timeout}ms)`);
	for await (const [data] of on(subprocess.stdout!, 'data', { signal: AbortSignal.timeout(timeout) })) {
		const text = data.toString();
		debug(`waitForOutput: received stdout data: ${text.trim()}`);
		if (text.includes(pattern)) {
			debug(`waitForOutput: matched "${pattern}"`);
			return;
		}
	}
};

export default testSuite('watch', ({ test }, nodePath: string) => {
	test('rebuilds on package.json change', async () => {
		debug('=== TEST START: rebuilds on package.json change ===');
		debug('platform:', process.platform);
		debug('nodePath:', nodePath);

		debug('creating fixture');
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				exports: './dist/index.js',
			}),
		});
		debug('fixture created at:', fixture.path);

		debug('starting watch process');
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
		debug('watch process pid:', watchProcess.pid);

		// Log ALL stdout/stderr from watch process
		watchProcess.stdout!.on('data', (data: Buffer) => {
			debug('process stdout:', data.toString().trim());
		});
		watchProcess.stderr!.on('data', (data: Buffer) => {
			debug('process stderr:', data.toString().trim());
		});
		watchProcess.on('exit', (code, signal) => {
			debug('process exit: code=', code, 'signal=', signal);
		});

		try {
			debug('waiting for initial Built');
			await waitForOutput(watchProcess, 'Built');
			debug('initial build done');

			const content = await fixture.readFile('dist/index.js', 'utf8');
			expect(content).toMatch('module.exports');
			debug('initial output verified');

			// Add a new export to package.json
			debug('writing new package.json');
			await fs.writeFile(
				path.join(fixture.path, 'package.json'),
				createPackageJson({
					exports: {
						'.': './dist/index.js',
						'./utils': './dist/utils.mjs',
					},
				}),
			);
			debug('package.json written, waiting for "package.json changed"');

			await waitForOutput(watchProcess, 'package.json changed', 10_000);
			debug('package.json change detected, waiting for rebuilt');
			await waitForOutput(watchProcess, 'Built', 15_000);
			debug('rebuild complete');

			const utilsContent = await fixture.readFile('dist/utils.mjs', 'utf8');
			expect(utilsContent).toMatch('export');
			debug('rebuild output verified');
		} finally {
			debug('killing watch process');
			watchProcess.kill();
			await watchProcess;
			debug('watch process terminated');
		}
		debug('=== TEST END ===');
	}, { retry: 3 });
});
