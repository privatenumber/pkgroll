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

	return spawn(nodePath, commandArguments, options);
};
