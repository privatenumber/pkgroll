import { testSuite } from 'manten';

export default testSuite(({ describe }, nodePath: string) => {
	describe('builds', async ({ runTestSuite }) => {
		runTestSuite(import('./output-commonjs.js'), nodePath);
		runTestSuite(import('./output-module.js'), nodePath);
		runTestSuite(import('./output-dual.js'), nodePath);
		runTestSuite(import('./output-types.js'), nodePath);
		runTestSuite(import('./env.js'), nodePath);
		runTestSuite(import('./target.js'), nodePath);
		runTestSuite(import('./minification.js'), nodePath);
		runTestSuite(import('./package-exports.js'), nodePath);
		runTestSuite(import('./package-imports.js'), nodePath);
		runTestSuite(import('./bin.js'), nodePath);
		runTestSuite(import('./dependencies.js'), nodePath);
		runTestSuite(import('./src-dist.js'), nodePath);
		runTestSuite(import('./sourcemap.js'), nodePath);
		runTestSuite(import('./typescript.js'), nodePath);
		runTestSuite(import('./clean-dist.js'), nodePath);
	});
});
