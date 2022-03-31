export { writeFileSync } from 'fs';
export { readFileSync } from 'node:fs';

export function sayHello(name: string) {
	return `Hello ${name}!`;
}
