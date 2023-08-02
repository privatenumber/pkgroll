import { gray } from 'kolorist';

const currentTime = () => (new Date()).toLocaleTimeString();

export const log = (...messages: unknown[]) => console.log(
	`[${gray(currentTime())}]`,
	...messages,
);
