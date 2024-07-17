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
	cwd: string;
	platform?: 'node'
	path: string;
	distPath: string;
	sourcePath: string;
}


const parseExportsMap = (
	exportMap: PackageJson['exports'],
	params: ParseExportsContext
): ExportEntry[] => {
	const {type, path, cwd, platform} = params;
	if (exportMap) {
		if (typeof exportMap === 'string') {
			if(isPath(exportMap)){

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
				(exportPath, index) => {
					const from = `${path}[${index}]`;
					return parseExportsMap(exportPath, {...params, path: from });
				},
			);
		}

		if (typeof exportMap === 'object') {
			return Object.entries(exportMap).flatMap(([key, value]) => {

				const baseParams = {
					...params,
					path: `${path}.${key}`
				};

				// otherwise, key is an export condition
				if (key === 'require') {
					return parseExportsMap(value, {
						...baseParams,
						type: 'commonjs',
					})
				}

				if (key === 'import') {
					return parseExportsMap(value, {
						...baseParams,
						type: 'module',
					})
				}

				if (key === 'types') {
					return parseExportsMap(value, {
						...baseParams,
						type: 'types' as PackageType,
					})
				}

				if (key === 'node') {
					return parseExportsMap(value, {
						...baseParams,
						platform: 'node',
					});
				}

				if (key === 'default') {
					return parseExportsMap(value, {
						...baseParams,
					});
				}

				if(isPath(key)){
					// key is a relative path
					// format the path a little more nicely
					return parseExportsMap(value, {...params, path: `${path}["${key}"]`});
				}

				// non-standard export condition, probably
				return parseExportsMap(value, {...params, path: `${path}.${key}`});
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

interface GetExportEntriesContext {
	cwd: string;
	distPath: string;
	sourcePath: string;
}
export const getExportEntries = (packageJson: PackageJson, ctx: GetExportEntriesContext) => {
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
			cwd: ctx.cwd,
			path: 'exports',
			distPath: ctx.distPath,
			sourcePath: ctx.sourcePath
		});
		for (const exportEntry of exportMap) {
			addExportPath(exportEntriesMap, exportEntry);
		}
	}

	return Object.values(exportEntriesMap);
};
