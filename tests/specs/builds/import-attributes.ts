import fs from 'node:fs/promises';
import path from 'node:path';
import { on } from 'node:events';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execa, execaNode } from 'execa';
import { createPackageJson } from '../../fixtures.js';
import { pkgroll } from '../../utils.js';

const pkgrollBinPath = path.resolve('./dist/cli.mjs');

export default testSuite('import attributes', ({ describe }, nodePath: string) => {
	describe('type: "text"', ({ test }) => {
		test('ESM: imports file as string', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import html from "./page.html" with { type: "text" };
					console.log(html);
				`,
				'src/page.html': '<h1>Hello World</h1>',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('<h1>Hello World</h1>');
		});

		test('CJS: imports file as string', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'commonjs',
					main: './dist/index.cjs',
				}),
				'src/index.js': `
					import html from "./page.html" with { type: "text" };
					console.log(html);
				`,
				'src/page.html': '<h1>Hello World</h1>',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.cjs', 'utf8');
			expect(content).toMatch('<h1>Hello World</h1>');
		});

		test('dynamic import with type: "text"', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					const { default: html } = await import("./page.html", { with: { type: "text" } });
					console.log(typeof html);
					console.log(html);
				`,
				'src/page.html': '<h1>Dynamic</h1>',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const { stdout } = await execa(nodePath, ['dist/index.mjs'], {
				cwd: fixture.path,
			});

			expect(stdout).toMatch('string');
			expect(stdout).toMatch('<h1>Dynamic</h1>');
		});

		test('runtime: text content is accessible as string', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import html from "./page.html" with { type: "text" };
					console.log(typeof html);
					console.log(html);
				`,
				'src/page.html': '<h1>Hello World</h1>',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const { stdout } = await execa(nodePath, ['dist/index.mjs'], {
				cwd: fixture.path,
			});

			expect(stdout).toMatch('string');
			expect(stdout).toMatch('<h1>Hello World</h1>');
		});
	});

	describe('type: "bytes"', ({ test }) => {
		// Proposal: https://github.com/tc39/proposal-import-bytes
		test('ESM: imports file as Uint8Array', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import bytes from "./data.bin" with { type: "bytes" };
					console.log(bytes);
				`,
				'src/data.bin': Buffer.from([0x00, 0x01, 0x02, 0xFF]),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.mjs', 'utf8');
			expect(content).toMatch('Uint8Array');
		});

		test('CJS: imports file as Uint8Array', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'commonjs',
					main: './dist/index.cjs',
				}),
				'src/index.js': `
					import bytes from "./data.bin" with { type: "bytes" };
					console.log(bytes);
				`,
				'src/data.bin': Buffer.from([0x00, 0x01, 0x02, 0xFF]),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.cjs', 'utf8');
			expect(content).toMatch('Uint8Array');
		});

		test('runtime: bytes content is Uint8Array', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import bytes from "./data.bin" with { type: "bytes" };
					console.log(bytes instanceof Uint8Array);
					console.log(bytes.length);
					console.log(bytes[0], bytes[1], bytes[2], bytes[3]);
				`,
				'src/data.bin': Buffer.from([0x00, 0x01, 0x02, 0xFF]),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const { stdout } = await execa(nodePath, ['dist/index.mjs'], {
				cwd: fixture.path,
			});

			const lines = stdout.split('\n');
			expect(lines[0]).toBe('true');
			expect(lines[1]).toBe('4');
			expect(lines[2]).toBe('0 1 2 255');
		});

		test('dynamic import with type: "bytes"', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					const { default: bytes } = await import("./data.bin", { with: { type: "bytes" } });
					console.log(bytes instanceof Uint8Array);
					console.log(bytes.length);
				`,
				'src/data.bin': Buffer.from([0x00, 0x01, 0x02]),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const { stdout } = await execa(nodePath, ['dist/index.mjs'], {
				cwd: fixture.path,
			});

			const lines = stdout.split('\n');
			expect(lines[0]).toBe('true');
			expect(lines[1]).toBe('3');
		});
	});

	describe('edge cases', ({ test }) => {
		test('empty text file', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import text from "./empty.txt" with { type: "text" };
					console.log(typeof text);
					console.log(JSON.stringify(text));
				`,
				'src/empty.txt': '',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const { stdout } = await execa(nodePath, ['dist/index.mjs'], {
				cwd: fixture.path,
			});

			expect(stdout).toMatch('string');
			expect(stdout).toMatch('""');
		});

		test('empty binary file', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import bytes from "./empty.bin" with { type: "bytes" };
					console.log(bytes instanceof Uint8Array);
					console.log(bytes.length);
				`,
				'src/empty.bin': Buffer.alloc(0),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const { stdout } = await execa(nodePath, ['dist/index.mjs'], {
				cwd: fixture.path,
			});

			const lines = stdout.split('\n');
			expect(lines[0]).toBe('true');
			expect(lines[1]).toBe('0');
		});

		test('warns on conflicting attributes for same file', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import text from "./file.txt" with { type: "text" };
					import bytes from "./file.txt" with { type: "bytes" };
					console.log(text);
					console.log(bytes);
				`,
				'src/file.txt': 'hello',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toMatch('import attributes');
		});

		test('file path with spaces', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import html from "./my page.html" with { type: "text" };
					console.log(html);
				`,
				'src/my page.html': '<h1>Spaced</h1>',
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const { stdout } = await execa(nodePath, ['dist/index.mjs'], {
				cwd: fixture.path,
			});

			expect(stdout).toBe('<h1>Spaced</h1>');
		});
	});

	describe('watch mode', ({ test }) => {
		test('rebuilds when imported text file changes', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.mjs',
				}),
				'src/index.js': `
					import html from "./page.html" with { type: "text" };
					console.log(html);
				`,
				'src/page.html': '<h1>Before</h1>',
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
				for await (const [data] of on(watchProcess.stdout!, 'data', { signal: AbortSignal.timeout(15_000) })) {
					if (data.toString().includes('Built')) {
						break;
					}
				}

				const initial = await fixture.readFile('dist/index.mjs', 'utf8');
				expect(initial).toMatch('<h1>Before</h1>');

				await fs.writeFile(
					path.join(fixture.path, 'src/page.html'),
					'<h1>After</h1>',
				);

				for await (const [data] of on(watchProcess.stdout!, 'data', { signal: AbortSignal.timeout(5000) })) {
					if (data.toString().includes('Built')) {
						break;
					}
				}

				const updated = await fixture.readFile('dist/index.mjs', 'utf8');
				expect(updated).toMatch('<h1>After</h1>');
			} finally {
				watchProcess.kill();
				await watchProcess;
			}
		});
	});
});
