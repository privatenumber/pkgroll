import path from 'node:path';
import { on } from 'node:events';
import spawn, {
	SubprocessError,
	type Options,
	type Result,
	type Subprocess,
} from 'nano-spawn';
import { expect } from 'manten';

const pkgrollBinPath = path.resolve('./dist/cli.mjs');

export const expectMatchesInOrder = (
	text: string,
	patterns: RegExp[],
) => {
	let lastIndex = 0;
	for (const pattern of patterns) {
		const match = text.slice(lastIndex).match(pattern);
		expect(match).toBeTruthy();
		lastIndex += match!.index! + match![0].length;
	}
};

export const node = (
	commandArguments: string[],
	options?: Options,
) => spawn(process.execPath, commandArguments, options);

export const pnpm = (commandArguments: string[], options?: Options) => spawn('pnpm', commandArguments, options);

export const killSubprocess = async (subprocess: Subprocess) => {
	const childProcess = await subprocess.nodeChildProcess;
	const close = Promise.withResolvers<void>();
	childProcess.once('close', close.resolve);
	childProcess.kill();
	await close.promise;
	await (process.platform === 'win32' ? subprocess.catch(() => undefined) : subprocess);
};

export const expectError: (
	result: Result | SubprocessError,
) => asserts result is SubprocessError = (result) => {
	expect(result).toBeInstanceOf(SubprocessError);
};

export const pkgroll = async (
	cliArguments: string[],
	{ nodePath, ...options }: Options & { nodePath: string },
) => await spawn(nodePath, [pkgrollBinPath, ...cliArguments], {
	...options,
	env: {
		...options.env,
		NODE_PATH: '',
	},
});

/**
 * Wait for `pattern` to appear in the subprocess's stdout, or throw.
 *
 * Default timeout (30s) is calibrated for the slowest legitimate case: cold
 * `pkgroll --watch` startup on Windows CI, which includes Node boot, type
 * stripping, pulling Rollup + esbuild + plugins off disk, and the first
 * Rollup pass. Subsequent (warm) rebuilds finish in well under a second, so
 * callers waiting on those should pass a tighter timeout explicitly.
 *
 * Output is accumulated across `data` events for two reasons:
 *   1. Chunk boundaries — a `data` event isn't guaranteed to contain a full
 *      logical message, so `pattern` could be split across two events.
 *   2. End-of-stream surfacing — if the subprocess exits before printing
 *      `pattern`, the iterator terminates cleanly. Throwing here turns that
 *      into a useful error instead of a silent `undefined` return that leaves
 *      the caller to fail later on a confusing assertion.
 */
export const waitForOutput = async (
	subprocess: Subprocess,
	pattern: string,
	timeout = 30_000,
) => {
	const childProcess = await subprocess.nodeChildProcess;
	let output = '';
	for await (const [data] of on(childProcess.stdout!, 'data', { signal: AbortSignal.timeout(timeout) })) {
		output += data.toString();
		if (output.includes(pattern)) {
			return;
		}
	}
	throw new Error(`Pattern ${JSON.stringify(pattern)} was not found in stdout before the stream ended. Output received:\n${output}`);
};
