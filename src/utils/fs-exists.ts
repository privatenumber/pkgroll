import fs from 'fs';

export const fsExists = (
	path: string,
) => fs.promises.access(path).then(
	() => true,
	() => false,
);
