import type { Plugin } from 'rollup';
import MagicString from 'magic-string';

const hashbangPattern = /^#!.*/;
export const stripHashbang = (): Plugin => ({
	name: 'strip-hashbang',

	transform: (code) => {
		if (!hashbangPattern.test(code)) {
			return null;
		}

		const transformed = new MagicString(code);
		transformed.replace(hashbangPattern, '');

		return {
			code: transformed.toString(),
			map: transformed.generateMap({ hires: true }),
		};
	},
});
