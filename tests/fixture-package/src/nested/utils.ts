export { writeFileSync } from 'fs';
export { readFileSync } from 'node:fs';

export function sayGoodbye(name: string) {
	console.log('Goodbye', name);
}
