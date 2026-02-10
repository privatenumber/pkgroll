import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, OutputBundle, OutputChunk } from 'rollup';

const licenseFileNames = ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENCE', 'LICENCE.txt', 'LICENCE.md'];

// Output marker (what we write)
const marker = '----------- BUNDLED DEPENDENCIES -----------';

// Match pattern: at least 2 dashes, BUNDLED DEPENDENCIES, at least 2 dashes
const markerPattern = /-{2,} BUNDLED DEPENDENCIES -{2,}/;

type LicenseOption = true | string;

type DependencyInfo = {
	name: string;
	version: string;
	license: string | null;
	author: string | null;
	contributors: string[];
	repository: string | null;
	licenseText: string | null;
};

const fileExists = (filePath: string) => fs.access(filePath).then(() => true, () => false);

const findLicenseFile = async (directory: string): Promise<string | undefined> => {
	for (const fileName of licenseFileNames) {
		const filePath = path.join(directory, fileName);
		if (await fileExists(filePath)) {
			return filePath;
		}
	}
	return undefined;
};

const parsePersonName = (
	person: string | { name?: string } | null | undefined,
): string | null => {
	if (!person) {
		return null;
	}

	if (typeof person === 'object') {
		return person.name ?? null;
	}

	// Parse "Name <email> (url)" format — extract just the name
	const angleBracket = person.indexOf('<');
	const paren = person.indexOf('(');
	let end = person.length;
	if (angleBracket > 0) {
		end = angleBracket;
	}
	if (paren > 0 && paren < end) {
		end = paren;
	}
	return person.slice(0, end).trim() || null;
};

const getRenderedModuleIds = (bundle: OutputBundle): Set<string> => {
	const moduleIds = new Set<string>();
	for (const output of Object.values(bundle)) {
		if (output.type !== 'chunk') {
			continue;
		}
		for (const [moduleId, moduleInfo] of Object.entries((output as OutputChunk).modules)) {
			if (moduleInfo.renderedLength > 0) {
				moduleIds.add(moduleId);
			}
		}
	}
	return moduleIds;
};

const buildDependencyInfo = async (
	packageJson: Record<string, unknown>,
	directory: string,
): Promise<DependencyInfo> => {
	const licenseFilePath = await findLicenseFile(directory);
	const licenseText = licenseFilePath
		? await fs.readFile(licenseFilePath, 'utf8')
		: null;

	const authorName = parsePersonName(
		packageJson.author as string | { name?: string } | null,
	);
	const contributorEntries = packageJson.contributors as
		(string | { name?: string })[] | undefined;
	const contributors = Array.isArray(contributorEntries)
		? contributorEntries
			.map(parsePersonName)
			.filter(Boolean) as string[]
		: [];

	const { repository } = packageJson;
	const repositoryUrl = repository
		? (typeof repository === 'string' ? repository : (repository as { url: string }).url)
		: null;

	return {
		name: packageJson.name as string,
		version: packageJson.version as string,
		license: (packageJson.license as string) ?? null,
		author: authorName,
		contributors,
		repository: repositoryUrl,
		licenseText,
	};
};

const findDependencyForModule = async (
	moduleId: string,
	cache: Map<string, DependencyInfo | null>,
): Promise<DependencyInfo | null> => {
	let directory = path.dirname(moduleId);

	while (directory !== path.dirname(directory)) {
		if (cache.has(directory)) {
			return cache.get(directory)!;
		}

		const packageJsonPath = path.join(directory, 'package.json');
		if (await fileExists(packageJsonPath)) {
			const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

			if (packageJson.name && packageJson.version) {
				const info = packageJson.private
					? null
					: await buildDependencyInfo(packageJson, directory);
				cache.set(directory, info);
				return info;
			}
		}

		directory = path.dirname(directory);
	}

	return null;
};

const collectBundledDependencies = async (
	bundle: OutputBundle,
): Promise<DependencyInfo[]> => {
	const moduleIds = getRenderedModuleIds(bundle);
	const cache = new Map<string, DependencyInfo | null>();
	const dependencies = new Map<string, DependencyInfo>();

	for (const moduleId of moduleIds) {
		if (!/[/\\]node_modules[/\\]/.test(moduleId)) {
			continue;
		}

		const info = await findDependencyForModule(moduleId, cache);
		if (info) {
			const key = `${info.name}@${info.version}`;
			if (!dependencies.has(key)) {
				dependencies.set(key, info);
			}
		}
	}

	return [...dependencies.values()];
};

const formatDependency = (dependency: DependencyInfo): string => {
	const lines: string[] = [`## ${dependency.name}@${dependency.version}`];

	if (dependency.license) {
		lines.push(`License: ${dependency.license}`);
	}

	const authors = new Set<string>();
	if (dependency.author) {
		authors.add(dependency.author);
	}
	for (const contributor of dependency.contributors) {
		authors.add(contributor);
	}
	if (authors.size > 0) {
		lines.push(`By: ${[...authors].join(', ')}`);
	}

	if (dependency.repository) {
		lines.push(`Repository: ${dependency.repository}`);
	}

	if (dependency.licenseText) {
		const quotedText = dependency.licenseText
			.trim()
			.replaceAll(/\r\n?/g, '\n')
			.split('\n')
			.map(line => `> ${line}`)
			.join('\n');
		lines.push('', quotedText);
	}

	return lines.join('\n');
};

const formatLicenseContent = (dependencies: DependencyInfo[]): string => {
	if (dependencies.length === 0) {
		return `${marker}\n\nNo bundled dependencies.`;
	}

	const sorted = dependencies.slice().sort((a, b) => {
		if (a.name !== b.name) {
			return a.name < b.name ? -1 : 1;
		}
		return a.version < b.version ? -1 : (a.version > b.version ? 1 : 0);
	});

	const separator = '\n\n---------------------------------------\n\n';
	const content = sorted.map(formatDependency).join(separator);

	return `${marker}\n\n${content}`;
};

const writeLicenseFile = async (
	filePath: string,
	dependencies: DependencyInfo[],
): Promise<void> => {
	const newContent = formatLicenseContent(dependencies);

	if (!(await fileExists(filePath))) {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, newContent, 'utf8');
		console.log(`License file created: ${filePath}`);
		return;
	}

	const existingContent = await fs.readFile(filePath, 'utf8');
	const markerMatch = markerPattern.exec(existingContent);

	let updatedContent: string;

	if (markerMatch) {
		updatedContent = existingContent.slice(0, markerMatch.index) + newContent;
	} else {
		updatedContent = `${existingContent.trimEnd()}\n\n${newContent}`;
	}

	if (existingContent === updatedContent) {
		return;
	}

	await fs.writeFile(filePath, updatedContent, 'utf8');
	console.log(`License file updated: ${filePath}`);
};

export const licensePlugin = (
	licenseOption: LicenseOption,
): Plugin => {
	const cwd = process.cwd();
	let hasRun = false;

	return {
		name: 'pkgroll-license',

		async generateBundle(_options, bundle) {
			if (this.meta.watchMode || hasRun) {
				return;
			}
			hasRun = true;

			const dependencies = await collectBundledDependencies(bundle);

			let outputPath: string;
			if (typeof licenseOption === 'string') {
				outputPath = path.resolve(cwd, licenseOption);
			} else {
				const existingFile = await findLicenseFile(cwd);
				outputPath = existingFile ?? path.join(cwd, 'LICENSE');
			}

			await writeLicenseFile(outputPath, dependencies);
		},
	};
};
