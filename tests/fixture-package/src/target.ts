
console.log(2 ** 3);

/**
 * Expect minification to apply ?. optional chaining.
 * https://github.com/evanw/esbuild/releases/tag/v0.14.25#:~:text=Minification%20now%20takes%20advantage%20of%20the%20%3F.%20operator
 */
export let foo = (x: any) => {
	if (x !== null && x !== undefined) x.y()
	return x === null || x === undefined ? undefined : x.z
}
