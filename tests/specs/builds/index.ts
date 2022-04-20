import { testSuite } from 'manten';
import specMain from './main';
import specModule from './module';
import specTarget from './target';
import specTypes from './types';
import specExports from './exports';
import specImports from './imports';
import specBin from './bin';
import specExternalizeDependencies from './externalize-dependencies';
import specSrcDist from './src-dist';

export default testSuite(({ describe }, nodePath: string) => {
	describe('builds', async ({ runTestSuite }) => {
		// runTestSuite(specMain, nodePath);
		// runTestSuite(specModule, nodePath);
		// runTestSuite(specTarget, nodePath);
		runTestSuite(specTypes, nodePath);
		// runTestSuite(specExports, nodePath);
		// runTestSuite(specImports, nodePath);
		// runTestSuite(specBin, nodePath);
		// runTestSuite(specExternalizeDependencies, nodePath);
		// runTestSuite(specSrcDist, nodePath);
	});
});
