import path from 'path';
import { getTsconfig as _getTsconfig, parseTsconfig } from 'get-tsconfig';

export const getTsconfig = (
	tscFile?: string,
) => {
	if (!tscFile) {
		return _getTsconfig();
	}

	const resolvedTscFile = path.resolve(tscFile);
	const config = parseTsconfig(resolvedTscFile);
	return {
		path: resolvedTscFile,
		config,
	};
};
