import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.ts';
import { createPackageJson } from '../../fixtures.ts';

export const license = (nodePath: string) => describe('license', () => {
	describe('auto-detect LICENSE file', () => {
		test('creates LICENSE if none exists', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'MIT',
							author: 'Test Author',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
						LICENSE: 'MIT License\n\nCopyright (c) Test Author',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			// Check LICENSE file was created
			expect(await fixture.exists('LICENSE')).toBe(true);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('test-dep@1.0.0');
			expect(content).toMatch('License: MIT');
			expect(content).toMatch('Test Author');
		});

		test('detects LICENSE.md and appends', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				'LICENSE.md': '# My License\n\nOriginal content',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '2.0.0',
							license: 'Apache-2.0',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			// Check LICENSE.md was appended (original content preserved)
			const content = await fixture.readFile('LICENSE.md', 'utf8');
			expect(content).toMatch('# My License');
			expect(content).toMatch('Original content');
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('test-dep@2.0.0');
			expect(content).toMatch('License: Apache-2.0');
		});
		test('detects LICENCE (British spelling) and appends', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				LICENCE: 'Original LICENCE content',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENCE', 'utf8');
			expect(content).toMatch('Original LICENCE content');
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('test-dep@1.0.0');
			expect(await fixture.exists('LICENSE')).toBe(false);
		});
	});

	describe('custom output path', () => {
		test('writes to specified path', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'ISC',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license=NOTICES.txt'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			// Check custom file was created
			expect(await fixture.exists('NOTICES.txt')).toBe(true);
			expect(await fixture.exists('LICENSE')).toBe(false);

			const content = await fixture.readFile('NOTICES.txt', 'utf8');
			expect(content).toMatch('test-dep@1.0.0');
			expect(content).toMatch('License: ISC');
		});

		test('creates intermediate directories for nested path', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license=legal/notices/LICENSES.txt'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('legal/notices/LICENSES.txt', 'utf8');
			expect(content).toMatch('test-dep@1.0.0');
			expect(content).toMatch('License: MIT');
		});

		test('does not duplicate custom output on rerun', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'ISC',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const firstRun = await pkgroll(['--license=NOTICES.txt'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(firstRun.exitCode).toBe(0);

			const secondRun = await pkgroll(['--license=NOTICES.txt'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(secondRun.exitCode).toBe(0);

			const content = await fixture.readFile('NOTICES.txt', 'utf8');
			expect(content).toMatch('test-dep@1.0.0');
			expect(content).toMatch('License: ISC');
			expect(content.split('----------- BUNDLED DEPENDENCIES -----------').length - 1).toBe(1);
			expect(await fixture.exists('LICENSE')).toBe(false);
		});
	});

	describe('marker replacement', () => {
		test('replaces content from marker to end', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				LICENSE: `# My Project License

MIT License for my project.

----------- BUNDLED DEPENDENCIES -----------

Old bundled content here
`,
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '3.0.0',
							license: 'BSD-3-Clause',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');

			// Header preserved
			expect(content).toMatch('# My Project License');
			expect(content).toMatch('MIT License for my project.');

			// New content after marker
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('test-dep@3.0.0');
			expect(content).toMatch('License: BSD-3-Clause');

			// Old content replaced
			expect(content).not.toMatch('Old bundled content here');
		});

		test('replaces content from marker on rerun', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				LICENSE: `# My Project License

MIT License for my project.

----------- BUNDLED DEPENDENCIES -----------

Old bundled content here
`,
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '3.0.0',
							license: 'BSD-3-Clause',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const firstRun = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(firstRun.exitCode).toBe(0);

			const secondRun = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(secondRun.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('# My Project License');
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('test-dep@3.0.0');
			expect(content).not.toMatch('Old bundled content here');
			expect(content.split('----------- BUNDLED DEPENDENCIES -----------').length - 1).toBe(1);
		});

		test('matches minimal marker format', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				LICENSE: `MIT License

-- BUNDLED DEPENDENCIES --

Old content
`,
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('MIT License');
			// Old minimal marker replaced with full marker
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('test-dep@1.0.0');
			expect(content).not.toMatch('Old content');
		});

		test('appends to existing LICENSE without marker', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				LICENSE: 'Original LICENSE content',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('Original LICENSE content');
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('test-dep@1.0.0');
		});

		test('does not duplicate appended licenses on rerun', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				LICENSE: 'Original LICENSE content',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const firstRun = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(firstRun.exitCode).toBe(0);

			const secondRun = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(secondRun.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('Original LICENSE content');
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('test-dep@1.0.0');
			expect(content.split('----------- BUNDLED DEPENDENCIES -----------').length - 1).toBe(1);
		});
	});

	describe('no bundled dependencies', () => {
		test('writes empty dependencies message', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
				}),
				'src/index.js': 'export default 1;',
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('----------- BUNDLED DEPENDENCIES -----------');
			expect(content).toMatch('No bundled dependencies');
		});

		test('does not duplicate empty dependencies on rerun', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
				}),
				'src/index.js': 'export default 1;',
			});

			const firstRun = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(firstRun.exitCode).toBe(0);

			const secondRun = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(secondRun.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('No bundled dependencies');
			expect(content.split('----------- BUNDLED DEPENDENCIES -----------').length - 1).toBe(1);
		});
	});

	describe('license content', () => {
		test('includes full license text', async () => {
			const licenseText = `MIT License

Copyright (c) 2024 Test Author

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.`;

			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'MIT',
							author: 'Test Author',
							repository: 'https://github.com/test/test-dep',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
						LICENSE: licenseText,
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('test-dep@1.0.0');
			expect(content).toMatch('License: MIT');
			expect(content).toMatch('By: Test Author');
			expect(content).toMatch('Repository: https://github.com/test/test-dep');
			// License text should be quoted
			expect(content).toMatch('> MIT License');
			expect(content).toMatch('> Copyright (c) 2024 Test Author');
		});

		test('reads LICENCE file from dependency (British spelling)', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'british-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "british-dep"; export default dep;',
				node_modules: {
					'british-dep': {
						'package.json': JSON.stringify({
							name: 'british-dep',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
						LICENCE: 'MIT Licence\n\nCopyright (c) British Author',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('british-dep@1.0.0');
			expect(content).toMatch('> MIT Licence');
			expect(content).toMatch('> Copyright (c) British Author');
		});

		test('includes contributors', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'test-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "test-dep"; export default dep;',
				node_modules: {
					'test-dep': {
						'package.json': JSON.stringify({
							name: 'test-dep',
							version: '1.0.0',
							license: 'MIT',
							author: { name: 'Main Author' },
							contributors: [
								{ name: 'Contributor One' },
								{ name: 'Contributor Two' },
							],
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('Main Author');
			expect(content).toMatch('Contributor One');
			expect(content).toMatch('Contributor Two');
		});
	});

	describe('dependency filtering', () => {
		test('excludes externalized dependencies', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					dependencies: {
						'external-dep': '*',
					},
					devDependencies: {
						'bundled-dep': '*',
					},
				}),
				'src/index.js': `
					import ext from "external-dep";
					import bun from "bundled-dep";
					export default ext + bun;
				`,
				node_modules: {
					'external-dep': {
						'package.json': JSON.stringify({
							name: 'external-dep',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 10;',
					},
					'bundled-dep': {
						'package.json': JSON.stringify({
							name: 'bundled-dep',
							version: '2.0.0',
							license: 'ISC',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 20;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('bundled-dep@2.0.0');
			expect(content).not.toMatch('external-dep');
		});

		test('lists same package at different versions', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'dep-a': '*',
						'dep-b': '*',
					},
				}),
				'src/index.js': `
					import a from "dep-a";
					import b from "dep-b";
					export default a + b;
				`,
				node_modules: {
					'dep-a': {
						'package.json': JSON.stringify({
							name: 'dep-a',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
							dependencies: {
								'shared-lib': '2.0.0',
							},
						}),
						'index.js': 'module.exports = require("shared-lib");',
						node_modules: {
							'shared-lib': {
								'package.json': JSON.stringify({
									name: 'shared-lib',
									version: '2.0.0',
									license: 'MIT',
									main: 'index.js',
								}),
								'index.js': 'module.exports = 20;',
							},
						},
					},
					'dep-b': {
						'package.json': JSON.stringify({
							name: 'dep-b',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
							dependencies: {
								'shared-lib': '3.0.0',
							},
						}),
						'index.js': 'module.exports = require("shared-lib");',
						node_modules: {
							'shared-lib': {
								'package.json': JSON.stringify({
									name: 'shared-lib',
									version: '3.0.0',
									license: 'ISC',
									main: 'index.js',
								}),
								'index.js': 'module.exports = 30;',
							},
						},
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('shared-lib@2.0.0');
			expect(content).toMatch('shared-lib@3.0.0');
		});

		test('excludes private packages', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'private-dep': '*',
					},
				}),
				'src/index.js': 'import dep from "private-dep"; export default dep;',
				node_modules: {
					'private-dep': {
						'package.json': JSON.stringify({
							name: 'private-dep',
							version: '1.0.0',
							license: 'MIT',
							private: true,
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			expect(content).toMatch('No bundled dependencies');
			expect(content).not.toMatch('private-dep');
		});
	});

	describe('multiple dependencies', () => {
		test('sorts dependencies alphabetically', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: './dist/index.js',
					devDependencies: {
						'zebra-pkg': '*',
						'alpha-pkg': '*',
						'middle-pkg': '*',
					},
				}),
				'src/index.js': `
					import z from "zebra-pkg";
					import a from "alpha-pkg";
					import m from "middle-pkg";
					export default z + a + m;
				`,
				node_modules: {
					'zebra-pkg': {
						'package.json': JSON.stringify({
							name: 'zebra-pkg',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 1;',
					},
					'alpha-pkg': {
						'package.json': JSON.stringify({
							name: 'alpha-pkg',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 2;',
					},
					'middle-pkg': {
						'package.json': JSON.stringify({
							name: 'middle-pkg',
							version: '1.0.0',
							license: 'MIT',
							main: 'index.js',
						}),
						'index.js': 'module.exports = 3;',
					},
				},
			});

			const pkgrollProcess = await pkgroll(['--license'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);

			const content = await fixture.readFile('LICENSE', 'utf8');
			const alphaIndex = content.indexOf('alpha-pkg');
			const middleIndex = content.indexOf('middle-pkg');
			const zebraIndex = content.indexOf('zebra-pkg');

			expect(alphaIndex).toBeLessThan(middleIndex);
			expect(middleIndex).toBeLessThan(zebraIndex);
		});
	});
});
