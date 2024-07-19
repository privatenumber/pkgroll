<p align="center">
	<img width="130" src=".github/logo.webp">
</p>
<h1 align="center">
	<sup>pkgroll</sup>
	<br>
	<a href="https://npm.im/pkgroll"><img src="https://badgen.net/npm/v/pkgroll"></a> <a href="https://npm.im/pkgroll"><img src="https://badgen.net/npm/dm/pkgroll"></a>
</h1>

_pkgroll_ is a JavaScript package bundler powered by Rollup that automatically builds your package from entry-points defined in `package.json`. No config necessary!

Write your code in TypeScript/ESM and run `pkgroll` to get ESM/CommonJS/.d.ts outputs!

### Features
- ✅ `package.json#exports` to define entry-points
- ✅ Dependency externalization
- ✅ Minification
- ✅ TypeScript support + `.d.ts` bundling
- ✅ Watch mode
- ✅ CLI outputs (auto hashbang insertion)

<br>

<p align="center">
	<a href="https://github.com/sponsors/privatenumber/sponsorships?tier_id=398771"><img width="412" src="https://raw.githubusercontent.com/privatenumber/sponsors/master/banners/assets/donate.webp"></a>
	<a href="https://github.com/sponsors/privatenumber/sponsorships?tier_id=397608"><img width="412" src="https://raw.githubusercontent.com/privatenumber/sponsors/master/banners/assets/sponsor.webp"></a>
</p>
<p align="center"><sup><i>Already a sponsor?</i> Join the discussion in the <a href="https://github.com/pvtnbr/pkgroll">Development repo</a>!</sup></p>

## Install
```sh
npm install --save-dev pkgroll
```

## Quick setup
1. Setup your project with source files in `src` and output in `dist` (configurable).

2. Define package entry-files in `package.json`.

    [These configurations](https://nodejs.org/api/packages.html#package-entry-points) are for Node.js to determine how to import the package.

    Pkgroll leverages the same configuration to determine how to build the package.

	```json5
	{
	    "name": "my-package",

	    // Set "module" or "commonjs" (https://nodejs.org/api/packages.html#type)
	    // "type": "module",

	    // Define the output files
	    "main": "./dist/index.cjs",
	    "module": "./dist/index.mjs",
	    "types": "./dist/index.d.cts",

	    // Define output files for Node.js export maps (https://nodejs.org/api/packages.html#exports)
	    "exports": {
	        "require": {
	            "types": "./dist/index.d.cts",
	            "default": "./dist/index.cjs"
	        },
	        "import": {
	            "types": "./dist/index.d.mts",
	            "default": "./dist/index.mjs"
	        }
	    },

	    // bin files will be compiled to be executable with the Node.js hashbang
	    "bin": "./dist/cli.js",

	    // (Optional) Add a build script referencing `pkgroll`
	    "scripts": {
	        "build": "pkgroll"
	    }

	    // ...
	}
	```

	Paths that start with `./dist/` are automatically mapped to files in the `./src/` directory.

3. Package roll!
	```sh
	npm run build # or npx pkgroll
	```

## Usage

### Entry-points
_Pkgroll_ parses package entry-points from `package.json` by reading properties `main`, `module`, `types`, and `exports`.

The paths in `./dist` are mapped to paths in `./src` (configurable with `--src` and `--dist` flags) to determine bundle entry-points.

### Output formats
_Pkgroll_ detects the format for each entry-point based on the file extension or the `package.json` property it's placed in, using the [same lookup logic as Node.js](https://nodejs.org/api/packages.html#determining-module-system).

| `package.json` property | Output format |
| - | - |
| `main` | Auto-detect |
| `module` | ESM<br><sub>Note: This [unofficial property](https://stackoverflow.com/a/42817320/911407) is not supported by Node.js and is mainly used by bundlers.</sub> |
| `types` | TypeScript declaration |
| `exports` | Auto-detect |
| `exports.require` | CommonJS |
| `exports.import` | Auto-detect |
| `exports.types` | TypeScript declaration |
| `bin` | Auto-detect<br>Also patched to be executable with the Node.js hashbang. |

_Auto-detect_ infers the type by extension or `package.json#type`:

| Extension | Output format |
| - | - |
| `.cjs` | [CommonJS](https://nodejs.org/api/packages.html#:~:text=Files%20ending%20with%20.cjs%20are%20always%20loaded%20as%20CommonJS%20regardless%20of%20the%20nearest%20parent%20package.json) |
| `.mjs` | [ECMAScript Modules](https://nodejs.org/api/modules.html#the-mjs-extension) |
| `.js` | Determined by `package.json#type`, defaulting to CommonJS |


### Dependency bundling & externalization

Packages to externalize are detected by reading dependency types in `package.json`. Only dependencies listed in `devDependencies` are bundled in.

When generating type declarations (`.d.ts` files), this also bundles and tree-shakes type dependencies declared in `devDependencies` as well.

```json5
// package.json
{
    // ...

    "peerDependencies": {
        // Externalized
    },
    "dependencies": {
        // Externalized
    },
    "optionalDependencies": {
        // Externalized
    },
    "devDependencies": {
        // Bundled
    },
}
```

### Aliases
Aliases can be configured in the [import map](https://nodejs.org/api/packages.html#imports), defined in `package.json#imports`.

For native Node.js import mapping, all entries must be prefixed with `#` to indicate an internal [subpath import](https://nodejs.org/api/packages.html#subpath-imports). _Pkgroll_ takes advantage of this behavior to define entries that are _not prefixed_ with `#` as an alias.

Native Node.js import mapping supports conditional imports (eg. resolving different paths for Node.js and browser), but _Pkgroll_ does not.

> ⚠️ Aliases are not supported in type declaration generation. If you need type support, do not use aliases.

```json5
{
    // ...

    "imports": {
        // Mapping '~utils' to './src/utils.js'
        "~utils": "./src/utils.js",

        // Native Node.js import mapping (can't reference ./src)
        "#internal-package": "./vendors/package/index.js",
    }
}
```

### Target

_Pkgroll_ uses [esbuild](https://esbuild.github.io/) to handle TypeScript and JavaScript transformation and minification.

The target specifies the environments the output should support. Depending on how new the target is, it can generate less code using newer syntax. Read more about it in the [esbuild docs](https://esbuild.github.io/api/#target).


By default, the target is set to the version of Node.js used. It can be overwritten with the `--target` flag:

```sh
pkgroll --target=es2020 --target=node14.18.0
```

It will also automatically detect and include the `target` specified in `tsconfig.json#compilerOptions`.


#### Strip `node:` protocol
Node.js builtin modules can be prefixed with the [`node:` protocol](https://nodejs.org/api/esm.html#node-imports) for explicitness:

```js
import fs from 'node:fs/promises'
```

This is a new feature and may not work in older versions of Node.js. While you can opt out of using it, your dependencies may still be using it (example package using `node:`: [path-exists](https://github.com/sindresorhus/path-exists/blob/7c95f5c1f5f811c7f4dac78ab5b9e258491f03af/index.js#L1)).

Pass in a Node.js target that that doesn't support it to strip the `node:` protocol from imports:

```sh
pkgroll --target=node12.19
```

### Custom `tsconfig.json` path

By default, _Pkgroll_ looks for `tsconfig.json` configuration file in the current working directory. You can pass in a custom `tsconfig.json` path with the `--tsconfig` flag:

```sh
pkgroll --tsconfig=tsconfig.build.json
```

### Export condition

Similarly to the target, the export condition specifies which fields to read from when evaluating [export](https://nodejs.org/api/packages.html#exports) and [import](https://nodejs.org/api/packages.html#imports) maps.

For example, to simulate import resolutions in Node.js, pass in `node` as the export condition:
```sh
pkgroll --export-condition=node
```


### ESM ⇄ CJS interoperability

Node.js ESM offers [interoperability with CommonJS](https://nodejs.org/api/esm.html#interoperability-with-commonjs) via [static analysis](https://github.com/nodejs/cjs-module-lexer). However, not all bundlers compile ESM to CJS syntax in a way that is statically analyzable.

Because _pkgroll_ uses Rollup, it's able to produce CJS modules that are minimal and interoperable with Node.js ESM.

This means you can technically output in CommonJS to get ESM and CommonJS support.

#### `require()` in ESM
Sometimes it's useful to use `require()` or `require.resolve()` in ESM. ESM code that uses `require()` can be seamlessly compiled to CommonJS, but when compiling to ESM, Node.js will error because `require` doesn't exist in the module scope.

When compiling to ESM, _Pkgroll_ detects `require()` usages and shims it with [`createRequire(import.meta.url)`](https://nodejs.org/api/module.html#modulecreaterequirefilename).

### Environment variables
Pass in compile-time environment variables with the `--env` flag.

This will replace all instances of `process.env.NODE_ENV` with `'production'` and remove unused code:
```sh
pkgroll --env.NODE_ENV=production
```

### Minification
Pass in the `--minify` flag to minify assets.
```sh
pkgroll --minify
```

### Watch mode
Run the bundler in watch mode during development:
```sh
pkgroll --watch
```

### Clean dist
Clean dist directory before bundling:
```sh
pkgroll --clean-dist
```

### Source maps
Pass in the `--sourcemap` flag to emit a source map file:

```sh
pkgroll --sourcemap
```

Or to inline them in the distribution files:
```sh
pkgroll --sourcemap=inline
```

## FAQ

### Why bundle with Rollup?
[Rollup](https://rollupjs.org/) has the best tree-shaking performance, outputs simpler  code, and produces seamless CommonJS and ESM formats (minimal interop code). Notably, CJS outputs generated by Rollup supports named exports so it can be parsed by Node.js ESM. TypeScript & minification transformations are handled by [esbuild](https://esbuild.github.io/) for speed.

### Why bundle Node.js packages?

- **ESM and CommonJS outputs**

	As the Node.js ecosystem migrates to [ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c), there will be both ESM and CommonJS users. A bundler helps accommodate both distribution types.

- **Dependency bundling** yields smaller and faster installation.

	Tree-shaking only pulls in used code from dependencies, preventing unused code and unnecessary files (eg. `README.md`, `package.json`, etc.) from getting downloaded.

	Removing dependencies also eliminates dependency tree traversal, which is [one of the biggest bottlenecks](https://dev.to/atian25/in-depth-of-tnpm-rapid-mode-how-could-we-fast-10s-than-pnpm-3bpp#:~:text=The%20first%20optimization%20comes%20from%20%27dependencies%20graph%27%3A).

- **Inadvertent breaking changes**

	Dependencies can introduce breaking changes due to a discrepancy in environment support criteria, by accident, or in rare circumstances, [maliciously](https://snyk.io/blog/peacenotwar-malicious-npm-node-ipc-package-vulnerability/).

	Compiling dependencies will make sure new syntax & features are downgraded to support the same environments. And also prevent any unexpected changes from sneaking in during installation.


- **Type dependencies** must be declared in the `dependencies` object in `package.json`, instead of `devDependencies`, to be resolved by the consumer.

	This may seem counterintuitive because types are a development enhancement. By bundling them in with your package, you remove the need for an external type dependency. Additionally, bundling only keeps the types that are actually used which helps minimize unnecessary bloat.

- **Minification** strips dead-code, comments, white-space, and shortens variable names.

## Sponsors

<p align="center">
	<a href="https://github.com/sponsors/privatenumber">
		<img src="https://cdn.jsdelivr.net/gh/privatenumber/sponsors/sponsorkit/sponsors.svg">
	</a>
</p>
