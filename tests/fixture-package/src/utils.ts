import type { SomeType } from './types';
export { writeFileSync } from 'fs';
export { readFileSync } from 'node:fs';

export function sayHello(name: SomeType) {
	return `Hello ${name}!`;
}
