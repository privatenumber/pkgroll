import path from 'node:path';
import { execaNode, type Options } from 'execa';

const pkgrollBinPath = path.resolve('./dist/cli.mjs');

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
