import fs from 'fs';
import path from 'path';
import { execaNode } from 'execa';

console.log('cwd', process.cwd());
console.log('contents', fs.readdirSync(process.cwd()));

const pkgrollBinPath = path.resolve('./dist/cli.js');

console.log('cwd', pkgrollBinPath);
console.log('contents', fs.readdirSync(path.dirname(pkgrollBinPath)));


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
