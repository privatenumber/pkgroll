import type { OutputOptions } from 'rollup';

export type Options = {
	minify: boolean;
	target: string[];
	exportCondition: string[];
	env: {
		key: string;
		value: string;
	}[];
	define: {
		key: string;
		value: string;
	}[];
	sourcemap?: true | 'inline';
	license?: true | string;
};

export const entrySymbol = Symbol('entry');

export type OutputWithOptions = OutputOptions & {
	[entrySymbol]: {
		inputNames?: string[];
	};
};

export type Output = OutputWithOptions[] & Record<string, OutputWithOptions>;
