import fs from 'node:fs';
import { cli } from 'cleye';
import { rollup, watch } from 'rollup';
import { version } from '../package.json';
import { readPackage } from './utils/read-package.js';
import { parseCliInputFlag } from './utils/get-build-entry-points/cli-input.js';
import { getAliases } from './utils/parse-package-json/get-aliases.js';
import { normalizePath } from './utils/normalize-path.js';
import { getBuildEntryPoints } from './utils/get-build-entry-points/index.js';
import { getRollupConfigs } from './rollup/get-rollup-configs.js';
import { getTsconfig } from './utils/get-tsconfig.js';
import { log, formatPath } from './utils/log.js';
import { cleanDist } from './utils/clean-dist.js';
import { prettyPath } from './utils/property-needs-quotes.js';
import type { EntryPointValid } from './utils/get-build-entry-points/types.js';
import type { SrcDistPairInput } from './types.js';
import { entrySymbol } from './rollup/types.js';
import { filterUnnecessaryOutputs } from './rollup/plugins/filter-unnecessary-outputs.js';

const { stringify } = JSON;

const keyValue = (flagValue: string) => {
	const [key, value] = flagValue.split('=', 2);
	return {
		key,
		value,
	};
};

const argv = cli({
	name: 'pkgroll',

	version,

	flags: {
		input: {
			type: [parseCliInputFlag],
			alias: 'i',
			description: 'Dist paths for source files to bundle (Only use if you cannot use package.json entries)',
		},
		src: {
			type: String,
			description: 'Source directory (Deprecated, use `srcdist` instead)',
			default: './src',
		},
		dist: {
			type: String,
			description: 'Distribution directory (Deprecated, use `srcdist` instead)',
			default: './dist',
		},
		srcdist: {
			type: [String],
			description: 'Source and distribution folder pairs (eg. default `src:dist`)',
		},
		minify: {
			type: Boolean,
			description: 'Minify output',
			alias: 'm',
			default: false,
		},
		target: {
			type: [String],
			default: [`node${process.versions.node}`],
			description: 'Environments to support. `target` in tsconfig.json is automatically added. Defaults to the current Node.js version.',
			alias: 't',
		},
		tsconfig: {
			type: String,
			description: 'Custom tsconfig.json file path',
			alias: 'p',
		},
		watch: {
			type: Boolean,
			description: 'Watch mode',
			alias: 'w',
			default: false,
		},
		env: {
			type: [keyValue],
			description: 'Compile-time environment variables (eg. --env.NODE_ENV=production)',
		},
		define: {
			type: [keyValue],
			description: 'Targeted strings to replace (eg. --define.process.env.NODE_ENV=\'production\')',
		},

		// TODO: rename to conditions and -C flag like Node.js
		exportCondition: {
			type: [String],
			description: 'Export conditions for resolving dependency export and import maps (eg. --export-condition=node)',
		},
		sourcemap: {
			type: (flagValue: string) => {
				if (flagValue === '') {
					return true;
				}
				if (flagValue === 'inline') {
					return flagValue;
				}

				throw new Error(`Invalid sourcemap option ${stringify(flagValue)}`);
			},
			description: 'Sourcemap generation. Provide `inline` option for inline sourcemap (eg. --sourcemap, --sourcemap=inline)',
		},
		cleanDist: {
			type: Boolean,
			description: 'Clean dist before bundling',
			default: false,
		},
	},

	help: {
		description: 'Minimalistic package bundler',
		render: (nodes, renderers) => {
			renderers.flagOperator = flagData => (
				(flagData.name === 'env')
					? '.key='
					: ' '
			);

			return renderers.render(nodes);
		},
	},
});

const cwd = process.cwd();

const srcDistPairs: SrcDistPairInput[] = [];

if (argv.flags.srcdist.length > 0) {
	for (const srcDist of argv.flags.srcdist) {
		const [src, dist] = srcDist.split(':', 2);
		if (!src || !dist) {
			throw new Error(`Invalid src:dist pair ${stringify(srcDist)}. Expected format: src:dist`);
		}

		srcDistPairs.push({
			src: normalizePath(src, true),
			srcResolved: normalizePath(fs.realpathSync.native(src), true),
			dist: normalizePath(dist, true),
		});
	}
} else {
	srcDistPairs.push({
		src: normalizePath(argv.flags.src, true),
		srcResolved: normalizePath(fs.realpathSync.native(argv.flags.src), true),
		dist: normalizePath(argv.flags.dist, true),
	});
}

const tsconfig = getTsconfig(argv.flags.tsconfig);
const tsconfigTarget = tsconfig?.config.compilerOptions?.target;
if (tsconfigTarget) {
	argv.flags.target.push(tsconfigTarget);
}

(async () => {
	const { packageJson } = await readPackage(cwd);
	const buildEntryPoints = await getBuildEntryPoints(srcDistPairs, packageJson, argv.flags.input);

	for (const entryPoint of buildEntryPoints) {
		if ('error' in entryPoint) {
			const { exportEntry } = entryPoint;
			const sourcePath = typeof exportEntry.source === 'string'
				? exportEntry.source
				: `${exportEntry.source.type}#${prettyPath(exportEntry.source.path)}`;
			console.warn(`Warning (${sourcePath}):`, entryPoint.error);
		}
	}

	const validEntryPoints = buildEntryPoints.filter((entry): entry is EntryPointValid => !('error' in entry));
	if (validEntryPoints.length === 0) {
		throw new Error('No entry points found');
	}

	const rollupConfigs = await getRollupConfigs(
		srcDistPairs,
		validEntryPoints,
		argv.flags,
		getAliases(packageJson, cwd),
		packageJson,
		tsconfig,
	);

	if (argv.flags.cleanDist) {
		/**
		 * Typically, something like this would be implemented as a plugin, so it only
		 * deletes what it needs to but pkgroll runs multiple builds (e.g. d.ts, mjs, etc)
		 * so as a plugin, it won't be aware of the files emitted by other builds
		 */
		await Promise.all(
			srcDistPairs.map(({ dist }) => cleanDist(dist)),
		);
	}

	if (argv.flags.watch) {
		log('Watch initialized');

		rollupConfigs.map(async (rollupConfig) => {
			const watcher = watch(rollupConfig);

			watcher.on('event', async (event) => {
				if (event.code === 'BUNDLE_START') {
					const inputFiles = Array.isArray(event.input) ? event.input : Object.values(event.input!);
					log('Building', ...inputFiles.map(formatPath));
				}

				if (event.code === 'BUNDLE_END') {
					await Promise.all(rollupConfig.output.map(
						outputOption => event.result.write(outputOption),
					));

					const inputFiles = Array.isArray(event.input) ? event.input : Object.values(event.input!);
					log('Built', ...inputFiles.map(formatPath));
				}

				if (event.code === 'ERROR') {
					log('Error:', event.error.message);
				}
			});
		});
	} else {
		await Promise.all(
			rollupConfigs.map(async (rollupConfig) => {
				const build = await rollup(rollupConfig);

				return Promise.all(rollupConfig.output.map(
					(outputOption) => {
						const inputNames = outputOption[entrySymbol].inputNames!;
						outputOption.plugins = [filterUnnecessaryOutputs(inputNames)];

						return build.write(outputOption);
					},
				));
			}),
		);
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
