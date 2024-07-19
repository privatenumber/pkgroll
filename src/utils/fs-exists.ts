import fs from 'fs';

export const fsExists = (
	path: string,
) => fs.existsSync(path);
