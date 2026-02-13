import { describe, setProcessTimeout } from 'manten';
import getNode from 'get-node';
import { errorCases } from './specs/error-cases.ts';
import { builds } from './specs/builds/index.ts';

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

describe('pkgroll', async () => {
	for (const nodeVersion of nodeVersions) {
		const node = await getNode(nodeVersion);
		await describe(`Node ${node.version}`, () => {
			errorCases(node.path);
			builds(node.path);
		});
	}
}, {
	timeout: 1000 * 60 * 10 - 2000, // under 10 minutes
});
