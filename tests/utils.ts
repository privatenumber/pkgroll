import path from 'node:path';
import { execaNode, type Options } from 'execa';
import { expect } from 'manten';

const pkgrollBinPath = path.resolve('./dist/cli.mjs');

export const expectMatchesInOrder = (
	text: string,
	patterns: RegExp[],
) => {
	let lastIndex = 0;
	for (const pattern of patterns) {
		const match = text.slice(lastIndex).match(pattern);
		expect(match).toBeTruthy();
		lastIndex += match!.index! + match![0].length;
	}
};

export const pkgroll = async (
	cliArguments: string[],
	options: Options,
) => await execaNode(
	pkgrollBinPath,
	cliArguments,
	{
		...options,
		env: {
			NODE_PATH: '',
		},
	},
);
