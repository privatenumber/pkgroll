import { gray } from 'kolorist';

const currentTime = () => (new Date()).toLocaleTimeString();

export const log = (...messages: any[]) => console.log(
	`[${gray(currentTime())}]`,
	...messages,
);
