#! /usr/bin/env node

console.log('side effect');

module.exports = function sayHello(name) {
	console.log('Hello', name);
};
