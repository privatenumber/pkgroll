import type { PackageJson } from 'type-fest';
import type { PackageType, ExportEntry } from '../../types';
import { normalizePath } from '../normalize-path';

const getFileType = (filePath: string): PackageType | undefined => {
	if (filePath.endsWith('.mjs')) {
		return 'module';
	}
	if (filePath.endsWith('.cjs')) {
		return 'commonjs';
	}
};

const isPath = (filePath: string) => filePath.startsWith('.');

function parseExportsMap(
	exportMap: PackageJson['exports'],
	packageType: PackageType,
	packagePath = 'exports',
): ExportEntry[] {
	if (exportMap) {
		if (typeof exportMap === 'string') {
			if (isPath(exportMap)) {
				return [{
					outputPath: exportMap,
					type: getFileType(exportMap) || packageType,
					from: packagePath,
				}];
			}

			return [];
		}

		if (Array.isArray(exportMap)) {
			const exportPaths = exportMap.filter(isPath);

			return exportPaths.map((exportPath, index) => ({
				outputPath: exportPath,
				type: getFileType(exportPath) || packageType,
				from: `${packagePath}[${index}]`,
			}));
		}

		if (typeof exportMap === 'object') {
			return Object.entries(exportMap).flatMap(([key, value]) => {
				if (typeof value === 'string') {
					const baseEntry = {
						outputPath: value,
						from: `${packagePath}.${key}`,
					};

					if (key === 'require') {
						return {
							...baseEntry,
							type: 'commonjs',
						};
					}

					if (key === 'import') {
						return {
							...baseEntry,
							type: getFileType(value) || packageType,
						};
					}

					if (key === 'types') {
						return {
							...baseEntry,
							type: 'types',
						};
					}

					if (key === 'node') {
						return {
							...baseEntry,
							type: getFileType(value) || packageType,
							platform: 'node',
						};
					}

					if (key === 'default') {
						return {
							...baseEntry,
							type: getFileType(value) || packageType,
						};
					}
				}

				return parseExportsMap(value, packageType, `${packagePath}.${key}`);
			});
		}
	}

	return [];
}

function addExportPath(
	exportPathsMap: Record<string, ExportEntry>,
	exportEntry: ExportEntry,
) {
	exportEntry.outputPath = normalizePath(exportEntry.outputPath);

	const { outputPath: exportPath, type, platform } = exportEntry;

	const existingExportPath = exportPathsMap[exportPath];
	if (existingExportPath) {
		if (existingExportPath.type !== type) {
			throw new Error(`Conflicting export types "${existingExportPath.type}" & "${type}" found for ${exportPath}`);
		}

		if (existingExportPath.platform !== platform) {
			throw new Error(`Conflicting export platforms "${existingExportPath.platform}" & "${platform}" found for ${exportPath}`);
		}
	}

	exportPathsMap[exportPath] = exportEntry;
}

export const getExportEntries = (packageJson: PackageJson) => {
	const exportEntriesMap: Record<string, ExportEntry> = {};
	const packageType = packageJson.type ?? 'commonjs';

	if (packageJson.main) {
		const mainPath = packageJson.main;
		addExportPath(exportEntriesMap, {
			outputPath: mainPath,
			type: getFileType(mainPath) ?? packageType,
			from: 'main',
		});
	}

	// Defacto module entry-point for bundlers (not Node.js)
	// https://github.com/dherman/defense-of-dot-js/blob/master/proposal.md
	if (packageJson.module) {
		addExportPath(exportEntriesMap, {
			outputPath: packageJson.module,
			type: 'module',
			from: 'module',
		});
	}

	// Entry point for TypeScript
	if (packageJson.types) {
		addExportPath(exportEntriesMap, {
			outputPath: packageJson.types,
			type: 'types',
			from: 'types',
		});
	}

	if (packageJson.bin) {
		const { bin } = packageJson;

		if (typeof bin === 'string') {
			addExportPath(exportEntriesMap, {
				outputPath: bin,
				type: getFileType(bin) ?? packageType,
				isExecutable: true,
				from: 'bin',
			});
		} else {
			for (const [binName, binPath] of Object.entries(bin)) {
				addExportPath(exportEntriesMap, {
					outputPath: binPath,
					type: getFileType(binPath) ?? packageType,
					isExecutable: true,
					from: `bin.${binName}`,
				});
			}
		}
	}

	if (packageJson.exports) {
		const exportMap = parseExportsMap(packageJson.exports, packageType);
		for (const exportEntry of exportMap) {
			addExportPath(exportEntriesMap, exportEntry);
		}
	}

	return Object.values(exportEntriesMap);
};
