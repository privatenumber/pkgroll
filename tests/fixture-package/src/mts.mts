export { sayGoodbye } from './mts2.mjs';
export { foo } from './target.js';
export { Component } from './component.jsx';
export { sayHello as sayHello2 } from './mjs.mjs';

export function sayHello(name: string) {
	console.log('Hello', name);
}
