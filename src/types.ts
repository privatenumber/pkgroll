export type AliasMap = { [alias: string]: string };

export type SrcDistPairInput = {
	src: string;
	dist: string;
	srcResolved: string;
};

export type SrcDistPair = SrcDistPairInput & {
	distPrefix: string;
};
