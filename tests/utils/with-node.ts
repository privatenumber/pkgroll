import { AsyncLocalStorage } from 'node:async_hooks';
import getNode from 'get-node';
import spawn, { type Options } from 'nano-spawn';

type NodeRuntime = {
	path: string;
	version: string;
};

const nodeRuntimeStorage = new AsyncLocalStorage<NodeRuntime>();

export const withNode = async <Return>(
	version: string,
	callback: () => Return,
) => {
	const nodeRuntime = await getNode(version);
	return nodeRuntimeStorage.run(nodeRuntime, callback);
};

const getNodeRuntime = () => {
	const nodeRuntime = nodeRuntimeStorage.getStore();
	if (!nodeRuntime) {
		throw new Error('Must be called inside withNode()');
	}
	return nodeRuntime;
};

export const node = (
	commandArguments: string[],
	options?: Options,
) => spawn(getNodeRuntime().path, commandArguments, options);

export const getNodeVersion = () => getNodeRuntime().version;
