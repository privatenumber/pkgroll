import { describe, setProcessTimeout } from 'manten';
import getNode from 'get-node';

setProcessTimeout(1000 * 60 * 10 - 1000); // Under 10 minutes

const nodeVersions = [
	'20',
	...(
		process.env.CI && process.platform !== 'win32'
			? [
				'18',
			]
			: []
	),
];

describe('manten', async ({ describe }) => {
	for (const nodeVersion of nodeVersions) {
		const node = await getNode(nodeVersion);
		await describe(`Node ${node.version}`, ({ runTestSuite }) => {
			runTestSuite(import('./specs/error-cases.js'), node.path);
			runTestSuite(import('./specs/builds/index.js'), node.path);
		});
	}
}, {
	timeout: 1000 * 60 * 10 - 2000, // under 10 minutes
});
