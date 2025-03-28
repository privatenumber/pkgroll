import type { PackageJson } from 'type-fest';
import type { PackageType, ExportEntry } from '../../types.js';
import { normalizePath } from '../normalize-path.js';
import { propertyNeedsQuotes } from '../property-needs-quotes.js';

const getFileType = (
	filePath: string,
): PackageType | 'types' | undefined => {
	if (filePath.endsWith('.mjs')) {
		return 'module';
	}
	if (filePath.endsWith('.cjs')) {
		return 'commonjs';
	}
	if (
		filePath.endsWith('.d.ts')
		|| filePath.endsWith('.d.cts')
		|| filePath.endsWith('.d.mts')
	) {
		return 'types';
	}
};

const isPath = (filePath: string) => filePath.startsWith('.');

const parseExportsMap = (
	exportMap: PackageJson['exports'],
	packageType: PackageType,
	packagePath = 'exports',
): ExportEntry[] => {
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
			return exportMap.flatMap(
				(exportPath, index) => {
					const from = `${packagePath}[${index}]`;

					return (
						typeof exportPath === 'string'
							? (
								isPath(exportPath)
									? {
										outputPath: exportPath,
										type: getFileType(exportPath) || packageType,
										from,
									}
									: []
							)
							: parseExportsMap(exportPath, packageType, from)
					);
				},
			);
		}

		if (typeof exportMap === 'object') {
			return Object.entries(exportMap).flatMap(([key, value]) => {
				if (typeof value === 'string') {
					const newProperty = propertyNeedsQuotes(key) ? `["${key}"]` : `.${key}`;
					const baseEntry = {
						outputPath: value,
						from: `${packagePath}${newProperty}`,
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

				const newProperty = propertyNeedsQuotes(key) ? `["${key}"]` : `.${key}`;
				return parseExportsMap(value, packageType, `${packagePath}${newProperty}`);
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

export const getExportEntries = (
	_packageJson: Readonly<PackageJson>,
) => {
	const packageJson = { ..._packageJson };

	// Prefer publishConfig when defined
	// https://pnpm.io/package_json#publishconfig
	const { publishConfig } = packageJson;
	if (publishConfig) {
		const fields = [
			'bin',
			'main',
			'exports',
			'types',
			'module',
		];

		for (const field of fields) {
			if (publishConfig[field]) {
				packageJson[field] = publishConfig[field];
			}
		}
	}

	const exportEntriesMap: Record<string, ExportEntry> = {};
	const packageType = packageJson.type ?? 'commonjs';

	const mainPath = packageJson.main;
	if (mainPath) {
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

	const { bin } = packageJson;
	if (bin) {
		if (typeof bin === 'string') {
			addExportPath(exportEntriesMap, {
				outputPath: bin,
				type: getFileType(bin) ?? packageType,
				isExecutable: true,
				from: 'bin',
			});
		} else {
			for (const [binName, binPath] of Object.entries(bin)) {
				const newProperty = propertyNeedsQuotes(binName) ? `["${binName}"]` : `.${binName}`;
				addExportPath(exportEntriesMap, {
					outputPath: binPath!,
					type: getFileType(binPath!) ?? packageType,
					isExecutable: true,
					from: `bin${newProperty}`,
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

export const parseCliInputFlag = (distPath: string): ExportEntry => {
	let isExecutable = false;

	if (distPath.includes('=')) {
		const [type, filePath] = distPath.split('=');
		distPath = filePath;
		isExecutable = type === 'bin' || type === 'binary';
	}
	return {
		outputPath: normalizePath(distPath),
		type: getFileType(distPath),
		isExecutable,
		from: 'cli',
	};
};
