import { testSuite } from 'manten';

export default testSuite('builds', ({ runTestSuite }, nodePath: string) => {
	runTestSuite(import('./output-commonjs.js'), nodePath);
	runTestSuite(import('./output-module.js'), nodePath);
	runTestSuite(import('./output-dual.js'), nodePath);
	runTestSuite(import('./output-types.js'), nodePath);
	runTestSuite(import('./env.js'), nodePath);
	runTestSuite(import('./define.js'), nodePath);
	runTestSuite(import('./native-modules.js'), nodePath);
	runTestSuite(import('./target.js'), nodePath);
	runTestSuite(import('./minification.js'), nodePath);
	runTestSuite(import('./package-exports.js'), nodePath);
	runTestSuite(import('./wildcard-exports.js'), nodePath);
	runTestSuite(import('./package-imports.js'), nodePath);
	runTestSuite(import('./imports.js'), nodePath);
	runTestSuite(import('./imports-alias.js'), nodePath);
	runTestSuite(import('./bin.js'), nodePath);
	runTestSuite(import('./dependencies.js'), nodePath);
	runTestSuite(import('./externalize-dependencies.js'), nodePath);
	runTestSuite(import('./real-dependencies.js'), nodePath);
	runTestSuite(import('./src-dist.js'), nodePath);
	runTestSuite(import('./sourcemap.js'), nodePath);
	runTestSuite(import('./typescript.js'), nodePath);
	runTestSuite(import('./clean-dist.js'), nodePath);
	runTestSuite(import('./package-yaml.js'), nodePath);
	runTestSuite(import('./watch.js'), nodePath);
}, {
	parallel: process.platform === 'win32' ? 2 : 'auto',
});
