import type { PackageJson } from 'type-fest';
import { normalizePath } from '../normalize-path.js';
import type {
	PackageType, BuildOutput, ObjectPath, PackageMapType,
} from './types.js';
import { getFileType, isPath } from './utils.js';

const getConditions = (
	fromPath: ObjectPath,
) => fromPath.slice(1).filter(part => (typeof part === 'string' && part[0] !== '.')) as string[];

const parsePackageMap = (
	packageMap: PackageJson['exports'] | PackageJson['imports'],
	packageType: PackageType,
	mapType: PackageMapType,
	packagePath: ObjectPath = [mapType],
): BuildOutput[] => {
	if (!packageMap) {
		return [];
	}

	if (typeof packageMap === 'string') {
		return [{
			source: {
				type: 'package.json',
				path: [...packagePath],
			},
			type: mapType,
			conditions: [],
			format: getFileType(packageMap) || packageType,
			outputPath: normalizePath(packageMap),
		}];
	}

	if (Array.isArray(packageMap)) {
		return packageMap.flatMap(
			(mapPath, index) => {
				const from = [...packagePath, index];
				return (
					typeof mapPath === 'string'
						? (
							isPath(mapPath)
								? {
									source: {
										type: 'package.json',
										path: [...from],
									},
									type: mapType,
									conditions: getConditions(from),
									format: getFileType(mapPath) || packageType,
									outputPath: normalizePath(mapPath),
								}
								: []
						)
						: parsePackageMap(mapPath, packageType, mapType, from)
				);
			},
		);
	}

	const isImports = mapType === 'imports' && packagePath.length === 1;
	return Object.entries(packageMap).flatMap(([key, value]) => {
		// For imports, only process # imports at the top level
		// Nested keys are export conditions (node, default, etc.)
		if (isImports && key[0] !== '#') {
			return [];
		}

		const from = [...packagePath, key];
		if (typeof value === 'string') {
			const conditions = getConditions(from);
			const baseEntry = {
				type: mapType,
				source: {
					type: 'package.json' as const,
					path: from,
				},
				outputPath: normalizePath(value),
				conditions,
			};

			if (conditions.includes('types')) {
				return {
					...baseEntry,
					format: 'types',
				};
			}

			return {
				...baseEntry,
				format: getFileType(value) || packageType,
			};
		}

		return parsePackageMap(value, packageType, mapType, from);
	});
};

export const getPkgEntryPoints = (
	packageJson: Readonly<PackageJson>,
	packageType: PackageType,
) => {
	const pkgEntryPoints: BuildOutput[] = [];

	const mainPath = packageJson.main;
	if (mainPath) {
		pkgEntryPoints.push({
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
		pkgEntryPoints.push({
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
		pkgEntryPoints.push({
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
			pkgEntryPoints.push({
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
				pkgEntryPoints.push({
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
		const exportMap = parsePackageMap(packageJson.exports, packageType, 'exports');
		pkgEntryPoints.push(...exportMap);
	}

	if (packageJson.imports) {
		const importEntries = parsePackageMap(packageJson.imports, packageType, 'imports');
		pkgEntryPoints.push(...importEntries);
	}

	return pkgEntryPoints;
};
