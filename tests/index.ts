import { describe } from 'manten';
import getNode from 'get-node';

const nodeVersions = [
	'12.22.9',
	...(
		process.env.CI
			? [
				'14.18.3',
				'16.13.2',
			]
			: []
	),
];

(async () => {
	for (const nodeVersion of nodeVersions) {
		const node = await getNode(nodeVersion);
		await describe(`Node ${node.version}`, ({ runTestSuite }) => {
			runTestSuite(import('./specs/error-cases'), node.path);
			runTestSuite(import('./specs/builds'), node.path);
		});
	}
})();
