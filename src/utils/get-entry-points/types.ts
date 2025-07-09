import type { SrcDistPair } from '../../types';

export type PackageType = 'module' | 'commonjs';

export type ObjectPath = (string | number)[];

type SourcePackageJson = {
	type: 'package.json';
	path: ObjectPath;
};
export type OutputSource = 'cli' | SourcePackageJson;

export type Format = 'module' | 'commonjs' | 'types';

type Output<T extends OutputSource> = {
	source: T;
	outputPath: string;
	format: Format;
};

export type BinaryOutput = Output<SourcePackageJson> & {
	type: 'binary';
};

export type ExportMapOutput = Output<SourcePackageJson> & {
	type: 'exportmap';
	conditions: string[];
};

// Any CLI input would also be considered legacy output
export type LegacyOutput = Output<OutputSource> & {
	type: 'legacy';
	isExecutable?: boolean;
};

export type BuildOutput = BinaryOutput | ExportMapOutput | LegacyOutput;

export type EntryPointValid<T extends BuildOutput = BuildOutput> = {
	sourcePath: string;
	srcExtension: string;
	distExtension: string;
	srcdist: SrcDistPair;
	exportEntry: T;
	inputNames?: string[];
};

export type EntryPointError<T extends BuildOutput = BuildOutput> = {
	error: string;
	exportEntry: T;
};

export type EntryPoint<T extends BuildOutput = BuildOutput> =
	| EntryPointValid<T>
	| EntryPointError<T>;
