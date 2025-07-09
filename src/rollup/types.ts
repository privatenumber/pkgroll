import type { OutputOptions } from 'rollup';
import type { EntryPointValid } from '../utils/get-entry-points/types';

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

export const entrySymbol = Symbol('entry');

export type OutputWithOptions = OutputOptions & {
	[entrySymbol]: EntryPointValid;
};

export type Output = OutputWithOptions[] & Record<string, OutputWithOptions>;
