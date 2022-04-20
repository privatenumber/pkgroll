import path from 'path';
import { execaNode } from 'execa';

const pkgrollBinPath = path.resolve('./dist/cli.js');

type Options = {
	arguments?: string[];
	cwd: string;
	nodePath: string;
};

export const pkgroll = async (
	cliArguments: string[],
	{
		cwd,
		nodePath,
	}: Options,
) => await execaNode(
	pkgrollBinPath,
	cliArguments,
	{
		nodeOptions: [],
		cwd,
		nodePath,
	},
);
