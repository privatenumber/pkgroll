import {
	describe, test, expect, onTestFail,
} from 'manten';
import { createFixture } from 'fs-fixture';
import { execaNode } from 'execa';
import { pkgroll } from '../../utils.ts';
import {
	installTypeScript,
	createPackageJson,
} from '../../fixtures.ts';

export const externalizeDependencies = (nodePath: string) => describe('externalize-dependencies plugin', () => {
	test('error if devDependency cannot be resolved', async () => {
		await using fixture = await createFixture({
			'src/index.js': 'import foo from "foo"',
			'package.json': createPackageJson({
				main: './dist/index.js',
				devDependencies: {
					foo: '*',
				},
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
			reject: false,
		});

		expect(pkgrollProcess.exitCode).toBe(1);

		const errorMessage = 'Could not resolve "foo" even though it\'s declared in package.json. Try re-installing node_modules.';
		expect(pkgrollProcess.stderr).toMatch(errorMessage);

		// Should appear once (from Rollup's handler, not duplicated)
		const occurrences = (pkgrollProcess.stderr as string).split(errorMessage).length - 1;
		expect(occurrences).toBe(1);
	});

	test('warn if unlisted dependency in source', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
				import unlisted from 'unlisted-package';
				console.log(unlisted);
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
			}),
			'node_modules/unlisted-package/index.js': 'export default 123',
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toMatch(/^"unlisted-package" imported by ".*\/src\/index\.js" but not declared in package\.json\. Will be bundled to prevent failure at runtime\.$/);

		const content = await fixture.readFile('dist/index.js', 'utf8');
		// Should be bundled (not externalized)
		expect(content).not.toMatch('require(\'unlisted-package\')');
	});

	test('warn if hoisted dependency imported from source (not declared in package.json)', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
				// Importing hoisted-dep directly from source, but it's not in package.json
				import hoisted from 'hoisted-dep';
				import declared from 'declared-package';
				console.log(hoisted, declared);
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				dependencies: {
					'declared-package': '*',
				},
			}),
			node_modules: {
				// declared-package depends on hoisted-dep, so it's available in node_modules
				'declared-package': {
					'package.json': JSON.stringify({
						name: 'declared-package',
						dependencies: {
							'hoisted-dep': '*',
						},
					}),
					'index.js': `
						import hoisted from 'hoisted-dep';
						export default 'declared-' + hoisted;
					`,
				},
				'hoisted-dep/index.js': 'export default "hoisted"',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		// Should warn because hoisted-dep is imported from source but not declared
		expect(pkgrollProcess.stderr).toMatch(/^"hoisted-dep" imported by ".*\/src\/index\.js" but not declared in package\.json\. Will be bundled to prevent failure at runtime\.$/);

		const content = await fixture.readFile('dist/index.js', 'utf8');
		// hoisted-dep should be bundled (not externalized)
		expect(content).not.toMatch('require(\'hoisted-dep\')');
		// declared-package should be externalized
		expect(content).toMatch('require(\'declared-package\')');
	});

	test('no warning when unlisted dependency imported from node_modules (not from source)', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
				// Only importing bundled-pkg from source
				import bundled from 'bundled-pkg';
				console.log(bundled);
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				devDependencies: {
					'bundled-pkg': '*',
				},
			}),
			node_modules: {
				// bundled-pkg imports unlisted-dep (not declared anywhere)
				'bundled-pkg/index.js': `
					import unlisted from 'unlisted-dep';
					export default 'bundled-' + unlisted;
				`,
				'unlisted-dep/index.js': 'export default "unlisted"',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		// Should NOT warn about unlisted-dep because it's imported from node_modules, not source
		expect(pkgrollProcess.stderr).not.toMatch('unlisted-dep');
		// Should NOT warn about bundled-pkg either (it's in devDependencies)
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		// Both should be bundled
		expect(content).not.toMatch('require(\'bundled-pkg\')');
		expect(content).not.toMatch('require(\'unlisted-dep\')');
		// Verify the actual functionality works (both values are in the bundle)
		expect(content).toMatch('unlisted');
	});

	test('externalize dependency even when only imported by devDependency', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
				import bar from 'bar';
				console.log(bar);
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				dependencies: {
					foo: '*',
				},
				devDependencies: {
					bar: '*',
				},
			}),
			node_modules: {
				'foo/index.js': 'export default "foo"',
				'bar/index.js': `
					import foo from 'foo';
					export default foo;
				`,
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		// bar is bundled (devDependency), but foo is externalized (dependency)
		expect(content).not.toMatch('require(\'bar\')');
		expect(content).toMatch('require(\'foo\')');
	});

	test('externalize # imports from source', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
				import utils from '#utils';
				console.log(utils);
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				imports: {
					'#utils': './dist/utils.js',
				},
			}),
			'src/utils.js': 'export default 123',
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		// # import should be externalized for Node.js runtime resolution
		expect(content).toMatch('require(\'#utils\')');
	});

	// TODO: Implement check for # imports in bundled dependencies
	// test('error if # import from dependency cannot be resolved', async () => {
	// 	await using fixture = await createFixture({
	// 		'src/index.js': `
	// 			import bar from 'bar';
	// 			console.log(bar);
	// 		`,
	// 		'package.json': createPackageJson({
	// 			main: './dist/index.js',
	// 			devDependencies: {
	// 				bar: '*',
	// 			},
	// 		}),
	// 		'node_modules/bar/package.json': JSON.stringify({
	// 			name: 'bar',
	// 			main: 'index.js',
	// 		}),
	// 		'node_modules/bar/index.js': `
	// 			// # import that won't resolve
	// 			import missing from '#missing';
	// 			export default missing;
	// 		`,
	// 	});
	//
	// 	let error: Error | undefined;
	// 	try {
	// 		await pkgroll([], {
	// 			cwd: fixture.path,
	// 			nodePath,
	// 		});
	// 	} catch (e) {
	// 		error = e as Error;
	// 	}
	//
	// 	expect(error).toBeDefined();
	// 	expect(error!.message).toMatch('#missing');
	// });

	test('bundle devDependency when resolvable', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
				import helper from 'helper';
				console.log(helper);
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				devDependencies: {
					helper: '*',
				},
			}),
			'node_modules/helper/index.js': 'export default "helper"',
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		// Should be bundled (not externalized)
		expect(content).not.toMatch('require(\'helper\')');
		expect(content).toMatch('"helper"');
	});

	test('externalize scoped package', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
				import scoped from '@org/package/subpath';
				console.log(scoped);
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				dependencies: {
					'@org/package': '*',
				},
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		expect(content).toMatch('require(\'@org/package/subpath\')');
	});

	test('externalize when package is in both dependencies and devDependencies', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
				import foo from 'foo';
				console.log(foo);
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				dependencies: {
					foo: '*',
				},
				devDependencies: {
					foo: '*',
				},
			}),
			'node_modules/foo/index.js': 'export default "foo"',
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		// Should be externalized (dependencies takes precedence)
		expect(content).toMatch('require(\'foo\')');
		expect(content).not.toMatch('"foo"');
		expect(content).not.toMatch('"foo"');
	});

	test('externalize @types/package as package (type-only packages)', async () => {
		await using fixture = await createFixture({
			'src/index.js': `
			import estree from 'estree';
			console.log(estree);
		`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				dependencies: {
					'@types/estree': '*',
				},
			}),
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');
		// estree should be externalized (mapped from @types/estree)
		expect(content).toMatch('require(\'estree\')');
	});

	test('warn if runtime package externalized but @types in devDependencies', async () => {
		await using fixture = await createFixture({
			'src/index.ts': `
				import type * as Eslint from 'eslint';
				export type { Eslint };
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				types: './dist/index.d.ts',
				peerDependencies: {
					eslint: '*',
				},
				devDependencies: {
					'@types/eslint': '*',
				},
			}),
			node_modules: {
				'@types/eslint/index.d.ts': 'export const Linter: any;',
			},
			...installTypeScript,
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toMatch(/^Recommendation: "@types\/eslint" is bundled \(devDependencies\) but "eslint" is externalized\. Place "@types\/eslint" in dependencies\/peerDependencies as well so users don't have missing types\./);

		const contentTypes = await fixture.readFile('dist/index.d.ts', 'utf8');
		// eslint types should be externalized (peerDependency)
		expect(contentTypes).toMatch('eslint');
	});

	test('add explicit extensions to externalized package imports', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
				dependencies: {
					'external-pkg': '*',
				},
			}),
			'src/index.ts': `
			// Import without extension - works in tsx, breaks in Node
			import { foo } from 'external-pkg/file-without-ext';
			console.log(foo);
			`,
			'node_modules/external-pkg': {
				'package.json': JSON.stringify({
					type: 'module',
					name: 'external-pkg',
				}),
				'file-without-ext.js': 'export const foo = \'bar\';',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');

		onTestFail(() => {
			console.log('Fixture path:', fixture.path);
			console.log('Build output:', content);
		});

		// pkgroll should rewrite import to have explicit .js extension
		expect(content).toMatch('\'external-pkg/file-without-ext.js\'');

		// Verify it actually runs in Node.js
		const { exitCode, stderr: runStderr } = await execaNode('dist/index.js', [], {
			cwd: fixture.path,
			reject: false,
		});
		if (exitCode !== 0) {
			console.log('Node.js stderr:', runStderr);
		}
		expect(exitCode).toBe(0);
	});

	test('package with exports (no subpaths) - keep original import', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
				dependencies: {
					'pkg-with-exports': '*',
				},
			}),
			'src/index.ts': `
			import { foo } from 'pkg-with-exports/file';
			console.log(foo);
			`,
			'node_modules/pkg-with-exports': {
				'package.json': JSON.stringify({
					type: 'module',
					name: 'pkg-with-exports',
					exports: {
						import: './index.js',
						require: './index.cjs',
					},
				}),
				'file.js': 'export const foo = \'bar\';',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');

		// Should NOT add extension - package has exports (conditions object)
		expect(content).toMatch('\'pkg-with-exports/file\'');
	});

	test('package with subpaths exports - defined subpath keeps original', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
				dependencies: {
					'pkg-with-subpaths': '*',
				},
			}),
			'src/index.ts': `
			import { foo } from 'pkg-with-subpaths/utils';
			console.log(foo);
			`,
			'node_modules/pkg-with-subpaths': {
				'package.json': JSON.stringify({
					type: 'module',
					name: 'pkg-with-subpaths',
					exports: {
						'.': './index.js',
						'./utils': './utils.js',
					},
				}),
				'utils.js': 'export const foo = \'bar\';',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');

		// Should NOT add extension - subpath is defined in exports
		expect(content).toMatch('\'pkg-with-subpaths/utils\'');
	});

	test('package with subpaths exports - undefined subpath keeps original', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
				dependencies: {
					'pkg-with-subpaths': '*',
				},
			}),
			'src/index.ts': `
			import { foo } from 'pkg-with-subpaths/other';
			console.log(foo);
			`,
			'node_modules/pkg-with-subpaths': {
				'package.json': JSON.stringify({
					type: 'module',
					name: 'pkg-with-subpaths',
					exports: {
						'.': './index.js',
						'./utils': './utils.js',
					},
				}),
				'other.js': 'export const foo = \'bar\';',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');

		// Should NOT add extension - package has exports field (even though subpath not defined)
		// Node.js will error at runtime if trying to access undefined subpath
		expect(content).toMatch('\'pkg-with-subpaths/other\'');
	});

	test('import with double extension (.min.js) resolves correctly', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
				dependencies: {
					'external-pkg': '*',
				},
			}),
			'src/index.ts': `
			import lib from 'external-pkg/lib.min';
			console.log(lib);
			`,
			'node_modules/external-pkg': {
				'package.json': JSON.stringify({
					type: 'module',
					name: 'external-pkg',
				}),
				'lib.min.js': 'export default \'minified\';',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');

		onTestFail(() => {
			console.log('Fixture path:', fixture.path);
			console.log('Build output:', content);
		});

		// Should add .js extension to lib.min
		expect(content).toMatch('\'external-pkg/lib.min.js\'');

		// Verify it actually runs in Node.js
		const { exitCode, stderr: runStderr } = await execaNode('dist/index.js', [], {
			cwd: fixture.path,
			reject: false,
		});
		if (exitCode !== 0) {
			console.log('Node.js stderr:', runStderr);
		}
		expect(exitCode).toBe(0);
	});

	test('directory import resolves to index.js', async () => {
		await using fixture = await createFixture({
			'package.json': createPackageJson({
				type: 'module',
				main: './dist/index.js',
				dependencies: {
					'external-pkg': '*',
				},
			}),
			'src/index.ts': `
			import utils from 'external-pkg/utils';
			console.log(utils);
			`,
			'node_modules/external-pkg': {
				'package.json': JSON.stringify({
					type: 'module',
					name: 'external-pkg',
				}),
				utils: {
					'index.js': 'export default \'utils\';',
				},
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('dist/index.js', 'utf8');

		onTestFail(() => {
			console.log('Fixture path:', fixture.path);
			console.log('Build output:', content);
		});

		// Should resolve directory to index.js
		expect(content).toMatch('\'external-pkg/utils/index.js\'');

		// Verify it actually runs in Node.js
		const { exitCode, stderr: runStderr } = await execaNode('dist/index.js', [], {
			cwd: fixture.path,
			reject: false,
		});
		if (exitCode !== 0) {
			console.log('Node.js stderr:', runStderr);
		}
		expect(exitCode).toBe(0);
	});

	test('hoisted dependency without exports gets bundled (not externalized)', async () => {
		await using fixture = await createFixture({
			project: {
				'package.json': createPackageJson({
					type: 'module',
					main: './dist/index.js',
					dependencies: {
						'hoisted-dep': '*',
					},
				}),
				'src/index.ts': `
				// Importing hoisted-dep which is available in node_modules (hoisted from declared-pkg)
				// Since it's not in package.json, it will be bundled
				import { util } from 'hoisted-dep/utils';
				console.log(util);
				`,
			},
			// hoisted-dep is available at top-level (hoisted)
			'node_modules/hoisted-dep': {
				'package.json': JSON.stringify({
					name: 'hoisted-dep',
					type: 'module',
				}),
				'utils.js': 'export const util = "hoisted-util";',
			},
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.getPath('project'),
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);
		expect(pkgrollProcess.stderr).toBe('');

		const content = await fixture.readFile('project/dist/index.js', 'utf8');

		onTestFail(() => {
			console.log('Fixture path:', fixture.path);
			console.log('Build output:', content);
		});

		// hoisted-dep should be externalized (declared in dependencies)
		// and should have explicit .js extension added
		expect(content).toMatch('\'hoisted-dep/utils.js\'');

		// Verify it actually runs in Node.js
		const { exitCode, stderr: runStderr } = await execaNode('dist/index.js', [], {
			cwd: fixture.getPath('project'),
			reject: false,
		});
		if (exitCode !== 0) {
			console.log('Node.js stderr:', runStderr);
		}
		expect(exitCode).toBe(0);
	});

	test('only warn about @types packages that are actually imported (fixes #49)', async () => {
		await using fixture = await createFixture({
			'src/index.ts': `
				import type * as Eslint from 'eslint';
				export type { Eslint };
			`,
			'package.json': createPackageJson({
				main: './dist/index.js',
				types: './dist/index.d.ts',
				peerDependencies: {
					eslint: '*',
				},
				dependencies: {
					'@eslint/eslintrc': '*',
					'@eslint/js': '*',
					'confusing-browser-globals': '*',
				},
				devDependencies: {
					'@types/eslint': '*',
					'@types/eslint__eslintrc': '*',
					'@types/eslint__js': '*',
					'@types/confusing-browser-globals': '*',
				},
			}),
			node_modules: {
				'@types/eslint/index.d.ts': 'export const Linter: any;',
				'@types/eslint__eslintrc/index.d.ts': 'export const ESLintRC: any;',
				'@types/eslint__js/index.d.ts': 'export const ESLintJS: any;',
				'@types/confusing-browser-globals/index.d.ts': 'export const globals: any;',
			},
			...installTypeScript,
		});

		const pkgrollProcess = await pkgroll([], {
			cwd: fixture.path,
			nodePath,
		});

		expect(pkgrollProcess.exitCode).toBe(0);

		// Should only warn about @types/eslint (the only imported package)
		expect(pkgrollProcess.stderr).toMatch(/^Recommendation: "@types\/eslint" is bundled \(devDependencies\) but "eslint" is externalized\. Place "@types\/eslint" in dependencies\/peerDependencies as well so users don't have missing types\./);

		// Should NOT warn about the other @types packages (not imported)
		expect(pkgrollProcess.stderr).not.toMatch('@types/eslint__eslintrc');
		expect(pkgrollProcess.stderr).not.toMatch('@types/eslint__js');
		expect(pkgrollProcess.stderr).not.toMatch('@types/confusing-browser-globals');

		const contentTypes = await fixture.readFile('dist/index.d.ts', 'utf8');
		// eslint types should be externalized
		expect(contentTypes).toMatch('eslint');
	});
});
