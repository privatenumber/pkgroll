import { getTsconfig as _getTsconfig } from 'get-tsconfig';

export const getTsconfig = (
	cwd: string,
	tscFile?: string,
) => (
	(
		tscFile
			? _getTsconfig(cwd, tscFile)
			: _getTsconfig()
	) ?? {
		path: cwd,
		config: {},
	}
);
