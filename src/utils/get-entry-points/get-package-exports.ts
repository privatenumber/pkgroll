import type { PackageJson } from 'type-fest';
import { normalizePath } from '../normalize-path.js';
import type { PackageType, BuildOutput, ObjectPath } from './types.js';
import { getFileType, isPath } from './utils.js';

const getConditions = (
	fromPath: ObjectPath,
) => fromPath.slice(1).filter(part => (typeof part === 'string' && part[0] !== '.')) as string[];

const parseExportsMap = (
	exportMap: PackageJson['exports'],
	packageType: PackageType,
	packagePath: ObjectPath = ['exports'],
): BuildOutput[] => {
	if (!exportMap) {
		return [];
	}

	if (typeof exportMap === 'string') {
		return [{
			source: {
				type: 'package.json',
				path: [...packagePath],
			},
			type: 'exportmap',
			conditions: [],
			format: getFileType(exportMap) || packageType,
			outputPath: normalizePath(exportMap),
		}];
	}

	if (Array.isArray(exportMap)) {
		return exportMap.flatMap(
			(exportPath, index) => {
				const from = [...packagePath, index];
				return (
					typeof exportPath === 'string'
						? (
							isPath(exportPath)
								? {
									source: {
										type: 'package.json',
										path: [...from],
									},
									type: 'exportmap',
									conditions: getConditions(from),
									format: getFileType(exportPath) || packageType,
									outputPath: normalizePath(exportPath),
								}
								: []
						)
						: parseExportsMap(exportPath, packageType, from)
				);
			},
		);
	}

	return Object.entries(exportMap).flatMap(([key, value]) => {
		const from = [...packagePath, key];
		if (typeof value === 'string') {
			const baseEntry = {
				type: 'exportmap' as const,
				source: {
					type: 'package.json' as const,
					path: from,
				},
				outputPath: normalizePath(value),
				conditions: getConditions(from),
			};

			if (key === 'require') {
				return {
					...baseEntry,
					format: 'commonjs',
				};
			}

			if (key === 'import') {
				return {
					...baseEntry,
					format: getFileType(value) || packageType,
				};
			}

			if (key === 'types') {
				return {
					...baseEntry,
					format: 'types',
				};
			}

			if (key === 'node') {
				return {
					...baseEntry,
					format: getFileType(value) || packageType,
					// platform: 'node',
				};
			}

			if (key === 'default') {
				return {
					...baseEntry,
					format: getFileType(value) || packageType,
				};
			}
		}

		return parseExportsMap(value, packageType, from);
	});
};

export const getPackageExports = (
	packageJson: Readonly<PackageJson>,
	packageType: PackageType,
) => {
	const exportEntries: BuildOutput[] = [];

	const mainPath = packageJson.main;
	if (mainPath) {
		exportEntries.push({
			source: {
				type: 'package.json',
				path: ['main'],
			},
			type: 'legacy',
			format: getFileType(mainPath) ?? packageType,
			outputPath: normalizePath(mainPath),
		});
	}

	// Defacto module entry-point for bundlers (not Node.js)
	// https://github.com/dherman/defense-of-dot-js/blob/master/proposal.md
	const modulePath = packageJson.module;
	if (modulePath) {
		exportEntries.push({
			source: {
				type: 'package.json',
				path: ['module'],
			},
			type: 'legacy',
			format: 'module',
			outputPath: normalizePath(modulePath),
		});
	}

	// Entry point for TypeScript
	const typesPath = packageJson.types;
	if (typesPath) {
		exportEntries.push({
			source: {
				type: 'package.json',
				path: ['types'],
			},
			type: 'legacy',
			format: 'types',
			outputPath: normalizePath(typesPath),
		});
	}

	const { bin } = packageJson;
	if (bin) {
		if (typeof bin === 'string') {
			exportEntries.push({
				source: {
					type: 'package.json',
					path: ['bin'],
				},
				type: 'binary',
				format: getFileType(bin) ?? packageType,
				outputPath: normalizePath(bin),
			});
		} else {
			for (const [binName, binPath] of Object.entries(bin)) {
				exportEntries.push({
					source: {
						type: 'package.json',
						path: ['bin', binName],
					},
					type: 'binary',
					format: getFileType(binPath!) ?? packageType,
					outputPath: normalizePath(binPath!),
				});
			}
		}
	}

	if (packageJson.exports) {
		const exportMap = parseExportsMap(packageJson.exports, packageType);
		for (const exportEntry of exportMap) {
			exportEntries.push(exportEntry);
		}
	}

	return exportEntries;
};
