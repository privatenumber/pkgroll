import path from 'path';
import fs from 'fs/promises';
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

export const installTypeScript = (fixturePath: string) => fs.symlink(
	path.resolve('node_modules/typescript'),
	path.join(fixturePath, 'node_modules/typescript'),
	'dir',
);
