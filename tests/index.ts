import { describe } from 'manten';
import getNode from 'get-node';

const nodeVersions = [
	'16.20.1',
	...(
		process.env.CI
			? [
				'18.17.0',
			]
			: []
	),
];

(async () => {
	for (const nodeVersion of nodeVersions) {
		const node = await getNode(nodeVersion);
		await describe(`Node ${node.version}`, ({ runTestSuite }) => {
			runTestSuite(import('./specs/error-cases.js'), node.path);
			runTestSuite(import('./specs/builds/index.js'), node.path);
		});
	}
})();
