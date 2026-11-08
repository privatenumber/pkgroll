import type { Plugin, RollupOptions } from 'rollup';
import type { EntryPointValid } from '../../utils/get-build-entry-points/types.ts';
import { slash } from '../../utils/normalize-path.ts';
import { type OutputWithOptions, entrySymbol } from '../types.ts';

const name = 'json-assets';

const minifyJson = (code: string) => {
	const input = Buffer.from(code, 'utf8');
	const output = Buffer.allocUnsafe(input.length);
	let length = 0;
	let inString = false;
	// UTF-8 continuation bytes cannot match ASCII quotes, escapes, or whitespace.
	for (let index = 0; index < input.length; index += 1) {
		const byte = input[index];
		if (inString && byte === 0x5C) {
			output[length] = byte;
			length += 1;
			index += 1;
			output[length] = input[index];
			length += 1;
			continue;
		}
		if (byte === 0x22) {
			inString = !inString;
		}
		if (!inString && (byte === 0x20 || byte === 0x09 || byte === 0x0A || byte === 0x0D)) {
			continue;
		}
		output[length] = byte;
		length += 1;
	}
	return output.toString('utf8', 0, length);
};

const jsonAssets = (
	entryPoints: EntryPointValid[],
	minify: boolean,
): Plugin => {
	const sourcePaths = new Set(entryPoints.map(entry => slash(entry.sourcePath)));

	return {
		name,

		transform(code, id) {
			if (!sourcePaths.has(slash(id))) {
				return;
			}

			try {
				JSON.parse(code);
			} catch (error) {
				this.error(`Failed to parse JSON: ${(error as Error).message}`);
			}

			// Rollup requires entries to be JavaScript modules. The placeholder
			// chunk is replaced with the JSON asset in generateBundle.
			return {
				code: 'export default 0;',
				meta: {
					[name]: {
						source: minify ? minifyJson(code) : code,
					},
				},
			};
		},

		generateBundle(_options, bundle) {
			for (const [fileName, output] of Object.entries(bundle)) {
				if (
					output.type !== 'chunk'
					|| !output.isEntry
					|| !output.facadeModuleId
					|| !sourcePaths.has(slash(output.facadeModuleId))
				) {
					continue;
				}

				const sourcePath = output.facadeModuleId;
				delete bundle[fileName];
				this.emitFile({
					type: 'asset',
					fileName,
					source: this.getModuleInfo(sourcePath)!.meta[name].source,
					originalFileName: sourcePath,
				});
			}
		},
	};
};

export const getJsonConfig = (
	entryPoints: EntryPointValid[],
	sharedDistDirectory: string,
	minify: boolean,
) => {
	const input: Record<string, string> = {};
	for (const entry of entryPoints) {
		input[entry.inputNames![0]] = entry.sourcePath;
	}

	const firstEntry = entryPoints[0];

	const output: OutputWithOptions = {
		dir: sharedDistDirectory,
		format: 'esm',
		entryFileNames: `[name]${firstEntry.distExtension}`,
		// One output covers every JSON entry, so collect all input names for
		// filterUnnecessaryOutputs.
		[entrySymbol]: {
			inputNames: entryPoints.flatMap(entry => entry.inputNames!),
		},
	};

	return {
		input,
		plugins: [jsonAssets(entryPoints, minify)],
		output: [output],
	} satisfies RollupOptions;
};
