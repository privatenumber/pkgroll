import fs from 'fs';

export const fsExists = (
	path: string,
) => {
	return fs.existsSync(path);
}
