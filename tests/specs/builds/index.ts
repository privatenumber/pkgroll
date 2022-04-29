import { testSuite } from 'manten';
import specMain from './output-commonjs';
import specEnv from './env';
import specTarget from './target';
import specMinification from './minification';
import specTypes from './types';
import specPackageExports from './package-exports';
import specPackageImports from './package-imports';
import specBin from './bin';
import specExternalizeDependencies from './externalize-dependencies';
import specSrcDist from './src-dist';

export default testSuite(({ describe }, nodePath: string) => {
	describe('builds', async ({ runTestSuite }) => {
		runTestSuite(specMain, nodePath);
		runTestSuite(specEnv, nodePath);
		runTestSuite(specTarget, nodePath);
		runTestSuite(specTypes, nodePath);
		runTestSuite(specMinification, nodePath);
		runTestSuite(specPackageExports, nodePath);
		runTestSuite(specPackageImports, nodePath);
		runTestSuite(specBin, nodePath);
		runTestSuite(specExternalizeDependencies, nodePath);
		runTestSuite(specSrcDist, nodePath);
	});
});
