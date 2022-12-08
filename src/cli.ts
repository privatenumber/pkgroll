import fs from 'fs';
import { cli } from 'cleye';
import { rollup, watch } from 'rollup';
import { version } from '../package.json';
import { readPackageJson } from './utils/read-package-json';
import { getExportEntries } from './utils/parse-package-json/get-export-entries';
import { getExternalDependencies } from './utils/parse-package-json/get-external-dependencies';
import { getAliases } from './utils/parse-package-json/get-aliases';
import { normalizePath } from './utils/normalize-path';
import { getSourcePath } from './utils/get-source-path';
import { getRollupConfigs } from './utils/get-rollup-configs';
import { tsconfig } from './utils/tsconfig';
import { log } from './utils/log';

const { stringify } = JSON;

const argv = cli({
	name: 'pkgroll',

	version,

	flags: {
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
		watch: {
			type: Boolean,
			description: 'Watch mode',
			alias: 'w',
			default: false,
		},
		env: {
			type: [function Env(flagValue: string) {
				const [key, value] = flagValue.split('=');
				return { key, value };
			}],
			description: 'Compile-time environment variables (eg. --env.NODE_ENV=production)',
		},
		exportCondition: {
			type: [String],
			description: 'Export conditions for resolving dependency export and import maps (eg. --export-condition=node)',
		},
		sourcemap: {
			type(flagValue: string) {
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
	},

	help: {
		description: 'Minimalistic package bundler',
		render(nodes, renderers) {
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

const tsconfigTarget = tsconfig?.config.compilerOptions?.target;
if (tsconfigTarget) {
	argv.flags.target.push(tsconfigTarget);
}

(async () => {
	const packageJson = await readPackageJson(cwd);

	let exportEntries = getExportEntries(packageJson);

	exportEntries = exportEntries.filter((entry) => {
		const validPath = entry.outputPath.startsWith(distPath);

		if (!validPath) {
			console.warn(`Ignoring entry outside of ${distPath} directory: package.json#${entry.from}=${stringify(entry.outputPath)}`);
		}

		return validPath;
	});

	if (exportEntries.length === 0) {
		throw new Error('No export entries found in package.json');
	}

	const sourcePaths = await Promise.all(exportEntries.map(async exportEntry => ({
		...(await getSourcePath(exportEntry, sourcePath, distPath)),
		exportEntry,
	})));

	const aliases = getAliases(packageJson, cwd);
	const externalDependencies = getExternalDependencies(packageJson).filter(
		dependency => !(dependency in aliases),
	).flatMap(dependency => [
		dependency,
		new RegExp(`^${dependency}/`),
	]);

	const rollupConfigs = await getRollupConfigs(
		/**
		 * Resolve symlink in source path.
		 *
		 * Tests since symlinks because tmpdir is a symlink:
		 * /var/ -> /private/var/
		 */
		normalizePath(fs.realpathSync.native(sourcePath), true),
		distPath,
		sourcePaths,
		argv.flags,
		aliases,
		externalDependencies,
	);

	if (argv.flags.watch) {
		log('Watch initialized');

		Object.values(rollupConfigs).map(async (rollupConfig) => {
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
			Object.values(rollupConfigs).map(async (rollupConfig) => {
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
