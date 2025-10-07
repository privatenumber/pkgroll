export type AliasMap = { [alias: string]: string };

export type SrcDistPair = {
	src: string;
	dist: string;
	srcResolved: string;
	distPrefix?: string;
};
