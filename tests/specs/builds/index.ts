import { testSuite } from 'manten';

export default testSuite(({ describe }, nodePath: string) => {
	describe('builds', async ({ runTestSuite }) => {
		// runTestSuite(import('./output-commonjs'), nodePath);
		// runTestSuite(import('./output-module'), nodePath);
		// runTestSuite(import('./output-types'), nodePath);
		// runTestSuite(import('./env'), nodePath);
		// runTestSuite(import('./target'), nodePath);
		// runTestSuite(import('./minification'), nodePath);
		// runTestSuite(import('./package-exports'), nodePath);
		// runTestSuite(import('./package-imports'), nodePath);
		runTestSuite(import('./package-pkgroll'), nodePath);
		// runTestSuite(import('./bin'), nodePath);
		// runTestSuite(import('./dependencies'), nodePath);
		// runTestSuite(import('./src-dist'), nodePath);
		// runTestSuite(import('./sourcemap'), nodePath);
		// runTestSuite(import('./typescript'), nodePath);
	});
});
