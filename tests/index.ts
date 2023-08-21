import { describe } from 'manten';
import getNode from 'get-node';

const nodeVersions = [
	'14.18',
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
