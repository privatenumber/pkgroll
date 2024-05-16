import fs from 'fs';
import { fsExists } from './fs-exists.js';

export const cleanDist = async (directoryPath: string) => {
	const exists = await fsExists(directoryPath);

	if (!exists) {
		return false;
	}

	await fs.promises.rm(directoryPath, {
		recursive: true,
		force: true,
	});
	await fs.promises.mkdir(directoryPath, {
		recursive: true,
	});

	return true;
};
