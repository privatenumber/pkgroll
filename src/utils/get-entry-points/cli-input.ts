import { normalizePath } from '../normalize-path.js';

export type CliEntry = {
	type: 'legacy';
	source: 'cli';
	outputPath: string;
	isExecutable: boolean;
};

export const parseCliInputFlag = (distPath: string): CliEntry => {
	let isExecutable = false;

	if (distPath.includes('=')) {
		const [type, filePath] = distPath.split('=');
		distPath = filePath;
		isExecutable = type === 'bin' || type === 'binary';
	}

	return {
		type: 'legacy',
		source: 'cli',
		outputPath: normalizePath(distPath),
		isExecutable,
	};
};
