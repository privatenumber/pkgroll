import { normalizePath } from '../normalize-path.js';
import { getFileType } from './utils.js';
import type { ExportEntry } from './types.js';

export const parseCliInputFlag = (distPath: string): ExportEntry => {
	let isExecutable = false;

	if (distPath.includes('=')) {
		const [type, filePath] = distPath.split('=');
		distPath = filePath;
		isExecutable = type === 'bin' || type === 'binary';
	}
	return {
		outputPath: normalizePath(distPath),
		type: getFileType(distPath),
		isExecutable,
		from: 'cli',
	};
};
