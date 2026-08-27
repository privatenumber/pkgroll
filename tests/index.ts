import { describe, setProcessTimeout } from 'manten';
import { errorCases } from './specs/error-cases.ts';
import { builds } from './specs/builds/index.ts';
import { withNode } from './utils/with-node.ts';

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
		await withNode(nodeVersion, () => describe(`Node ${nodeVersion}`, () => {
			errorCases();
			builds();
		}));
	}
}, {
	timeout: 1000 * 60 * 10 - 2000, // under 10 minutes
});
