import { testSuite, expect } from 'manten';
import { outdent } from 'outdent';
import { createFixture, type FileTree } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import {
	installTypeScript,
	createPackageJson,
} from '../../fixtures.js';

const fixtureDependencyExportsMap = (entryFile: string): FileTree => ({
	'package.json': createPackageJson({
		main: entryFile,
		devDependencies: {
			'dependency-exports-dual': '*',
		},
	}),

	src: {
		'dependency-exports-require.js': outdent`
		console.log(require('dependency-exports-dual'));
		`,

		'dependency-exports-import.js': outdent`
		import esm from 'dependency-exports-dual';

		console.log(esm);
		`,
	},

	'node_modules/dependency-exports-dual': {
		'file.js': outdent`
		module.exports = 'cjs';
		`,
		'file.mjs': outdent`
		export default 'esm';
		`,
		'package.json': createPackageJson({
			name: 'dependency-exports-dual',
			exports: {
				require: './file.js',
				import: './file.mjs',
			},
		}),
	},
});

const fixtureDependencyImportsMap: FileTree = {
	'package.json': createPackageJson({
		main: './dist/dependency-imports-map.js',
		devDependencies: {
			'dependency-imports-map': '*',
		},
	}),

	'src/dependency-imports-map.js': outdent`
	import value from 'dependency-imports-map';
	console.log(value);
	`,

	'node_modules/dependency-imports-map': {
		'default.js': outdent`
		module.exports = 'default';
		`,
		'index.js': outdent`
		console.log(require('#conditional'));
		`,
		'node.js': outdent`
		module.exports = 'node';
		`,
		'package.json': createPackageJson({
			name: 'dependency-exports-dual',
			imports: {
				'#conditional': {
					node: './node.js',
					default: './default.js',
				},
			},
		}),
	},
};

export default testSuite(({ describe }, nodePath: string) => {
	describe('dependencies', ({ test }) => {
		test('externalize dependencies', async () => {
			await using fixture = await createFixture({
				'src/dependency-external.js': `
				/**
				 * Should be imported with a package.json
				 * with "@org/name" in the "dependency" field
				 */
				import someValue from '@org/name/path';

				console.log(someValue);
				`,

				'package.json': createPackageJson({
					main: './dist/dependency-external.js',
					dependencies: {
						'@org/name': '*',
					},
				}),
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dependency-external.js', 'utf8');
			expect(content).toMatch('require(\'@org/name/path\')');
		});

		test('externalize types', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					types: 'dist/index.d.ts',
					dependencies: {
						'@types/pkg': '*',
						'@types/square-icons__react': '*',
					},
				}),
				'node_modules/@types': {
					'pkg/index.d.ts': 'export type typeA = {}',
					'square-icons__react/index.d.ts': 'export type typeB = {}',
				},
				'src/index.d.ts': `
				import type { typeA } from 'pkg';
				import type { typeB } from '@square-icons/react';
				export const a: typeA;
				export const b: typeB;
				`,

				...installTypeScript,
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.d.ts', 'utf8');
			expect(content).toMatch('from \'pkg\'');
			expect(content).toMatch('from \'@square-icons/react\'');
		});

		test('bundle in types if only in devDependency', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					types: 'dist/index.d.ts',
					devDependencies: {
						'@types/react': '*',
					},
				}),
				'node_modules/@types/react': {
					'index.d.ts': 'declare const A: { b: number }; export { A }',
				},
				'src/index.d.ts': 'export { A } from "react"',
				...installTypeScript,
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/index.d.ts', 'utf8');
			expect(content).toBe('declare const A: { b: number };\n\nexport { A };\n');
		});

		test('externalize dependency & type despite devDependency type', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					main: 'dist/index.js',
					types: 'dist/index.d.ts',
					dependencies: {
						react: '*',
					},
					devDependencies: {
						'@types/react': '*',
					},
				}),
				node_modules: {
					'@types/react': {
						'index.d.ts': 'declare const A: { b: number }; export { A }',
					},
					react: {
						'index.js': 'export const A = {}',
					},
				},
				'src/index.ts': 'export { A } from "react"',
				...installTypeScript,
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});
			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe(
				'Recommendation: "@types/react" is externalized because "react" is in "dependencies". Place "@types/react" in "dependencies" as well so users don\'t have missing types.',
			);

			const contentJs = await fixture.readFile('dist/index.js', 'utf8');
			expect(contentJs).toMatch('require(\'react\')');

			// Types externalized despite @types/react being a devDependency
			const contentTypes = await fixture.readFile('dist/index.d.ts', 'utf8');
			expect(contentTypes).toBe('export { A } from \'react\';\n');
		});

		test('no type recommendation when types are not compiled', async () => {
			await using fixture = await createFixture({
				'package.json': createPackageJson({
					bin: 'dist/index.js',
					dependencies: {
						react: '*',
					},
					devDependencies: {
						'@types/react': '*',
					},
				}),
				node_modules: {
					'@types/react': {
						'index.d.ts': 'declare const A: { b: number }; export { A }',
					},
					react: {
						'index.js': 'export const A = {}',
					},
				},
				'src/index.ts': 'export { A } from "react"',
				...installTypeScript,
			});

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');
		});

		test('dual package - require', async () => {
			await using fixture = await createFixture(
				fixtureDependencyExportsMap('./dist/dependency-exports-require.js'),
			);

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dependency-exports-require.js', 'utf8');
			expect(content).toMatch('cjs');
		});

		test('dual package - import', async () => {
			await using fixture = await createFixture(
				fixtureDependencyExportsMap('./dist/dependency-exports-import.js'),
			);

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dependency-exports-import.js', 'utf8');
			expect(content).toMatch('esm');
		});

		test('imports map - default', async () => {
			await using fixture = await createFixture(fixtureDependencyImportsMap);

			const pkgrollProcess = await pkgroll([], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dependency-imports-map.js', 'utf8');
			expect(content).toMatch('default');
		});

		test('imports map - node', async () => {
			await using fixture = await createFixture(fixtureDependencyImportsMap);
			const pkgrollProcess = await pkgroll(['--export-condition=node'], {
				cwd: fixture.path,
				nodePath,
			});

			expect(pkgrollProcess.exitCode).toBe(0);
			expect(pkgrollProcess.stderr).toBe('');

			const content = await fixture.readFile('dist/dependency-imports-map.js', 'utf8');
			expect(content).toMatch('node');
		});
	});
});
