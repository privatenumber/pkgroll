import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { packageFixture, createPackageJson } from '../../fixtures.ts';
import { waitForOutput } from '../../utils.ts';
import { node } from '../../utils/with-node.ts';

const pkgrollBinPath = path.resolve('./dist/cli.mjs');

export const watch = () => describe('watch', () => {
	test('rebuilds on package.json change', async () => {
		await using fixture = await createFixture({
			...packageFixture(),
			'package.json': createPackageJson({
				exports: './dist/index.js',
			}),
		});

		await using watchProcess = node([pkgrollBinPath, '--watch'], {
			cwd: fixture.path,
			env: { NODE_PATH: '' },
		});

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
	});

	test('rebuilds json entries after a parse error', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				exports: {
					'./data': './dist/data.json',
				},
			}),
			src: {
				'data.json': '{"version":1}',
			},
		});

		await using watchProcess = node([pkgrollBinPath, '--watch'], {
			cwd: fixture.path,
			env: { NODE_PATH: '' },
		});

		await waitForOutput(watchProcess, 'Built');
		expect(await fixture.readFile('dist/data.json', 'utf8')).toBe('{"version":1}');

		await fs.writeFile(
			path.join(fixture.path, 'src/data.json'),
			'{ invalid',
		);
		await waitForOutput(watchProcess, 'Failed to parse JSON', 5000);

		await fs.writeFile(
			path.join(fixture.path, 'src/data.json'),
			'{"version":2}',
		);

		await waitForOutput(watchProcess, 'Built', 5000);
		expect(await fixture.readFile('dist/data.json', 'utf8')).toBe('{"version":2}');
	});
});
