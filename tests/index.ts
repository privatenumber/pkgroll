import { describe } from 'manten';
import getNode from 'get-node';

const nodeVersions = [
	'12.22.12',
	...(
		process.env.CI
			? [
				// '14.21.3',
				// '16.20.1',
				// '18.17.0',
			]
			: []
	),
];

(async () => {
	for (const nodeVersion of nodeVersions) {
		const node = await getNode(nodeVersion);
		await describe(`Node ${node.version}`, ({ runTestSuite }) => {
			// runTestSuite(import('./specs/error-cases.js'), node.path);
			runTestSuite(import('./specs/builds/index.js'), node.path);
		});
	}
})();
