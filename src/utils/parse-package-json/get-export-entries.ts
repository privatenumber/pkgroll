import type { PackageJson } from 'type-fest';
import type { PackageType, ExportEntry } from '../../types.js';
import { normalizePath } from '../normalize-path.js';

const getFileType = (
	filePath: string,
): PackageType | undefined => {
	if (filePath.endsWith('.mjs')) {
		return 'module';
	}
	if (filePath.endsWith('.cjs')) {
		return 'commonjs';
	}
};

const isPath = (filePath: string) => filePath.startsWith('.');

interface ParseExportsContext {
	type: PackageType | 'types';
	platform?: 'node';
	path: string;
}

const parseExportsMap = (
	exportMap: PackageJson['exports'],
	parameters: ParseExportsContext,
): ExportEntry[] => {
	const { type, path } = parameters;
	if (exportMap) {
		if (typeof exportMap === 'string') {
			if (isPath(exportMap)) {
				return [{
					outputPath: exportMap,
					type: getFileType(exportMap) || type,
					from: path,
				}];
			}

			return [];
		}

		if (Array.isArray(exportMap)) {
			return exportMap.flatMap(
				(exportPath, index) => parseExportsMap(exportPath, {
					...parameters,
					path: `${path}[${index}]`,
				}),
			);
		}

		if (typeof exportMap === 'object') {
			return Object.entries(exportMap).flatMap(([key, value]) => {
				const baseParameters = {
					...parameters,
					path: `${path}.${key}`,
				};

				// otherwise, key is an export condition
				if (key === 'require') {
					return parseExportsMap(value, {
						...baseParameters,
						type: 'commonjs',
					});
				}

				if (key === 'import') {
					return parseExportsMap(value, {
						...baseParameters,
						type: 'module',
					});
				}

				if (key === 'types') {
					return parseExportsMap(value, {
						...baseParameters,
						type: 'types' as PackageType,
					});
				}

				if (key === 'node') {
					return parseExportsMap(value, {
						...baseParameters,
						platform: 'node',
					});
				}

				if (key === 'default') {
					return parseExportsMap(value, {
						...baseParameters,
					});
				}

				if (isPath(key)) {
					// key is a relative path
					// format the path a little more nicely
					return parseExportsMap(value, {
						...parameters,
						path: `${path}["${key}"]`,
					});
				}

				// non-standard export condition, probably
				return parseExportsMap(value, {
					...parameters,
					path: `${path}.${key}`,
				});
			});
		}
	}

	return [];
};

const addExportPath = (
	exportPathsMap: Record<string, ExportEntry>,
	exportEntry: ExportEntry,
) => {
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

		Object.assign(existingExportPath, exportEntry);
	} else {
		exportPathsMap[exportPath] = exportEntry;
	}
};

export const getExportEntries = (packageJson: PackageJson) => {
	const exportEntriesMap: Record<string, ExportEntry> = {};
	const type = packageJson.type ?? 'commonjs';

	if (packageJson.main) {
		const mainPath = packageJson.main;
		addExportPath(exportEntriesMap, {
			outputPath: mainPath,
			type: getFileType(mainPath) ?? type,
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
				type: getFileType(bin) ?? type,
				isExecutable: true,
				from: 'bin',
			});
		} else {
			for (const [binName, binPath] of Object.entries(bin)) {
				addExportPath(exportEntriesMap, {
					outputPath: binPath!,
					type: getFileType(binPath!) ?? type,
					isExecutable: true,
					from: `bin.${binName}`,
				});
			}
		}
	}

	if (packageJson.exports) {
		const exportMap = parseExportsMap(packageJson.exports, {
			type,
			path: 'exports',
		});
		for (const exportEntry of exportMap) {
			addExportPath(exportEntriesMap, exportEntry);
		}
	}

	return Object.values(exportEntriesMap);
};
