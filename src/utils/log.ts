import path from 'node:path';
import { dim } from 'kolorist';
import { normalizePath } from './normalize-path.js';

const currentTime = () => (new Date()).toLocaleTimeString();

export const log = (...messages: unknown[]) => console.log(
	dim(currentTime()),
	...messages,
);

const cwd = process.cwd();
export const formatPath = (absolutePath: string) => normalizePath(path.relative(cwd, absolutePath));
