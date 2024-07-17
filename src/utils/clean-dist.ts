import fs from 'fs';
import { fsExists } from './fs-exists.js';

export const cleanDist = async (directoryPath: string) => {
	const exists = fsExists(directoryPath);
	if (!exists) {
		return;
	}

	await fs.promises.rm(directoryPath, {
		recursive: true,
		force: true,
	});
};
