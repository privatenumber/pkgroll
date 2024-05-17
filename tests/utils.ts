import path from 'path';
import fs from 'fs/promises';
import { execaNode, type Options } from 'execa';

const pkgrollBinPath = path.resolve('./dist/cli.js');

export const pkgroll = async (
	cliArguments: string[],
	options: Options,
) => await execaNode(
	pkgrollBinPath,
	cliArguments,
	{
		...options,
		nodeOptions: [],
	},
);

export const installTypeScript = async (fixturePath: string) => {
	const nodeModulesDirectory = path.join(fixturePath, 'node_modules');

	await fs.mkdir(nodeModulesDirectory, { recursive: true });
	await fs.symlink(
		path.resolve('node_modules/typescript'),
		path.join(nodeModulesDirectory, 'typescript'),
		'dir',
	);
};
