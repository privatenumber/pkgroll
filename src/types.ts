export type PackageType = 'module' | 'commonjs';

export type ExportEntry = {
	outputPath: string;
	type: PackageType | 'types' | undefined;
	platform?: 'node';
	isExecutable?: boolean;
	from: string;
};

export type AliasMap = { [alias: string]: string };
