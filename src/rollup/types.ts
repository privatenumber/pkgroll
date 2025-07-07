import type { OutputOptions } from 'rollup';

export type Options = {
	minify: boolean;
	target: string[];
	exportCondition: string[];
	env: {
		key: string;
		value: string;
	}[];
	sourcemap?: true | 'inline';
};

export type Output = OutputOptions[] & Record<string, OutputOptions>;
