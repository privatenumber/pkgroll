import fs from 'fs';

export const fsExists = (
	path: string,
) => {
	console.log("check existence of ", path);
	return fs.existsSync(path);
}
