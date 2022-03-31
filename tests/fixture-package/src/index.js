import value from './value.js';
import { Component } from './component.tsx';
import { sayHello } from './utils';
import { sayHello as sayHelloMjs } from './mjs.mjs';
import { sayHello as sayHelloMts } from './mts.mts';
import { sayHello as sayHelloCjs } from './cjs.cjs';
import { sayHello as sayHelloCts } from './cts.cts';

console.log(
	Component,
	sayHello,
	sayHelloMjs,
	sayHelloMts,
	sayHelloCjs,
	sayHelloCts,
);

export default value * 2;
