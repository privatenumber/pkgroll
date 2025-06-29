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
import { log } from './utils/log.js';
import { cleanDist } from './utils/clean-dist.js';

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

/**
 * The sourcepath may be a symlink.
 * In the tests, the temp directory is a symlink:
 * /var/folders/hl/ -> /private/var/folders/hl/
 */
const sourcePath = normalizePath(argv.flags.src, true);
const distPath = normalizePath(argv.flags.dist, true);

const tsconfig = getTsconfig(argv.flags.tsconfig);
const tsconfigTarget = tsconfig?.config.compilerOptions?.target;
if (tsconfigTarget) {
	argv.flags.target.push(tsconfigTarget);
}

(async () => {
	const packageJson = await readPackageJson(cwd);
	const entryPoints = await getEntryPoints(sourcePath, distPath, packageJson, argv.flags.input);
	if (entryPoints.length === 0) {
		throw new Error('No entry points found');
	}

	const rollupConfigs = await getRollupConfigs(

		/**
		 * Resolve symlink in source path.
		 *
		 * Tests since symlinks because tmpdir is a symlink:
		 * /var/ -> /private/var/
		 */
		normalizePath(fs.realpathSync.native(sourcePath), true),
		distPath,
		entryPoints,
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
		await cleanDist(distPath);
	}

	if (argv.flags.watch) {
		log('Watch initialized');

		rollupConfigs.map(async (rollupConfig) => {
			const watcher = watch(rollupConfig);

			watcher.on('event', async (event) => {
				if (event.code === 'BUNDLE_START') {
					log('Building', ...(Array.isArray(event.input) ? event.input : [event.input]));
				}

				if (event.code === 'BUNDLE_END') {
					await Promise.all(rollupConfig.output.map(
						outputOption => event.result.write(outputOption),
					));

					log('Built', ...(Array.isArray(event.input) ? event.input : [event.input]));
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
