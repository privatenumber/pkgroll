import { normalizePath } from '../normalize-path.ts';

export type CliEntry = {
	type: 'legacy' | 'binary';
	source: 'cli';
	outputPath: string;
};

export const parseCliInputFlag = (input: string): CliEntry => {
	const [modifier, distPath] = input.includes('=') ? input.split('=') : [undefined, input];

	return {
		type: modifier === 'bin' || modifier === 'binary' ? 'binary' : 'legacy',
		source: 'cli',
		outputPath: normalizePath(distPath),
	};
};
