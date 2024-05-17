import path from 'path';
import { execa, type Options } from 'execa';

const pkgrollBinPath = path.resolve('./dist/cli.js');

export const pkgroll = async (
	cliArguments: string[],
	options: Options,
) => await execa(
	pkgrollBinPath,
	cliArguments,
	{
		...options,
		env: {
			NODE_PATH: '',
		},
	},
);
