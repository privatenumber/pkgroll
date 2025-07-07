import fs from 'node:fs';
import { cli } from 'cleye';
import { rollup, watch } from 'rollup';
import { version } from '../package.json';
import { readPackageJson } from './utils/read-package-json.js';
import { parseCliInputFlag } from './utils/get-entry-points/cli-input.js';
import { getAliases } from './utils/parse-package-json/get-aliases.js';
import { normalizePath } from './utils/normalize-path.js';
import { getEntryPoints } from './utils/get-entry-points/index.js';
import { getRollupConfigs } from './rollup/get-rollup-configs.js';
import { getTsconfig } from './utils/get-tsconfig';
import { log, formatPath } from './utils/log.js';
import { cleanDist } from './utils/clean-dist.js';
import type { EntryPointValid } from './utils/get-entry-points/types.js';
import type { SrcDistPair } from './types.js';

const { stringify } = JSON;

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
			description: 'Source directory',
			default: './src',
		},
		dist: {
			type: String,
			description: 'Distribution directory',
			default: './dist',
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
			type: [
				(flagValue: string) => {
					const [key, value] = flagValue.split('=');
					return {
						key,
						value,
					};
				},
			],
			description: 'Compile-time environment variables (eg. --env.NODE_ENV=production)',
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

const srcDist: SrcDistPair = {
	src: normalizePath(argv.flags.src, true),
	srcResolved: normalizePath(fs.realpathSync.native(argv.flags.src), true),
	dist: normalizePath(argv.flags.dist, true),
};

const tsconfig = getTsconfig(argv.flags.tsconfig);
const tsconfigTarget = tsconfig?.config.compilerOptions?.target;
if (tsconfigTarget) {
	argv.flags.target.push(tsconfigTarget);
}

(async () => {
	const { packageJson } = await readPackageJson(cwd);
	const entryPoints = await getEntryPoints(srcDist, packageJson, argv.flags.input);

	for (const entryPoint of entryPoints) {
		if ('error' in entryPoint) {
			console.warn(entryPoint.error);
		}
	}

	const validEntryPoints = entryPoints.filter((entry): entry is EntryPointValid => !('error' in entry));
	if (validEntryPoints.length === 0) {
		throw new Error('No entry points found');
	}

	const rollupConfigs = await getRollupConfigs(
		srcDist,
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
		await cleanDist(srcDist.dist);
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
				const bundle = await rollup(rollupConfig);

				return Promise.all(rollupConfig.output.map(
					outputOption => bundle.write(outputOption),
				));
			}),
		);
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
