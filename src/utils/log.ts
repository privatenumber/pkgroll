import { dim } from 'kolorist';

const currentTime = () => (new Date()).toLocaleTimeString();

export const log = (...messages: unknown[]) => console.log(
	dim(currentTime()),
	...messages,
);
