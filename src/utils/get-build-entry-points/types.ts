import type { SrcDistPairInput } from '../../types';

export type PackageType = 'module' | 'commonjs';

export type ObjectPath = (string | number)[];

type SourcePackageJson = {
	type: 'package.json';
	path: ObjectPath;
};
export type OutputSource = 'cli' | SourcePackageJson;

export type Format = 'module' | 'commonjs' | 'types' | 'json';

type Output<T extends OutputSource> = {
	source: T;
	outputPath: string;
	format: Format;
};

export type BinaryOutput = Output<SourcePackageJson> & {
	type: 'binary';
	// Hashbang line read from the entry source file at discovery time. Used by
	// patch-binary to prepend the same hashbang on the output. Absent when the
	// source has none; patch-binary falls back to `#!/usr/bin/env node`.
	hashbang?: string;
};

export type PackageMapType = 'exports' | 'imports';

export type PackageMapOutput = Output<SourcePackageJson> & {
	type: PackageMapType;
	conditions: string[];
};

// Any CLI input would also be considered legacy output
export type LegacyOutput = Output<OutputSource> & {
	type: 'legacy';
	isExecutable?: boolean;
};

export type BuildOutput = BinaryOutput | PackageMapOutput | LegacyOutput;

export type EntryPointValid<T extends BuildOutput = BuildOutput> = {
	sourcePath: string;
	srcExtension: string;
	distExtension: string;
	srcdist: SrcDistPairInput;
	exportEntry: T;
	inputNames?: string[];
};

export type EntryPointError<T extends BuildOutput = BuildOutput> = {
	error: string;
	exportEntry: T;
};

export type EntryPoint<T extends BuildOutput = BuildOutput> =	| EntryPointValid<T>
	| EntryPointError<T>;
