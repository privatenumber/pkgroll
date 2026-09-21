import { AsyncLocalStorage } from 'node:async_hooks';
import getNode from 'get-node';
import spawn, { type Options } from 'nano-spawn';

const nodePathStorage = new AsyncLocalStorage<string>();

export const withNode = async <Return>(
	version: string,
	callback: () => Return,
) => {
	const { path } = await getNode(version);
	return nodePathStorage.run(path, callback);
};

export const node = (
	commandArguments: string[],
	options?: Options,
) => {
	const nodePath = nodePathStorage.getStore();
	if (!nodePath) {
		throw new Error('node() must be called inside withNode()');
	}

	const subprocess = spawn(nodePath, commandArguments, options);

	/**
	 * The returned subprocess can be declared with `await using` to kill it on
	 * scope exit, which is required for processes that keep running (such as
	 * `pkgroll --watch`) and lets the fixture they build into outlive them.
	 */
	return Object.assign(subprocess, {
		[Symbol.asyncDispose]: async () => {
			const childProcess = await subprocess.nodeChildProcess;

			if (childProcess.exitCode === null && childProcess.signalCode === null) {
				const closed = Promise.withResolvers<void>();
				childProcess.once('close', closed.resolve);
				childProcess.kill();
				await closed.promise;
			}

			// Windows cannot deliver SIGTERM, so a terminated process exits non-zero
			await (process.platform === 'win32' ? subprocess.catch(() => undefined) : subprocess);
		},
	});
};
