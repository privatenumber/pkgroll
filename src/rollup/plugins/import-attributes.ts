import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'rollup';

// Supports:
// - import html from "./index.html" with { type: "text" }
// - import bytes from "./photo.png" with { type: "bytes" }
// - const bytes = await import("./photo.png", { with: { type: "bytes" } })
//
// Proposals:
// - https://github.com/tc39/proposal-import-attributes
// - https://github.com/tc39/proposal-import-bytes
export const importAttributes = (): Plugin => ({
	name: 'import-attributes',

	async resolveId(source, importer, { attributes }) {
		if (attributes.type !== 'text' && attributes.type !== 'bytes') {
			return null;
		}

		if (!importer || (!source.startsWith('./') && !source.startsWith('../'))) {
			return null;
		}

		return path.resolve(path.dirname(importer), source);
	},

	async load(id) {
		const { attributes } = this.getModuleInfo(id)!;

		if (attributes.type === 'text') {
			this.addWatchFile(id);
			const content = await fs.readFile(id, 'utf8');
			return `export default ${JSON.stringify(content)}`;
		}

		if (attributes.type === 'bytes') {
			this.addWatchFile(id);
			const content = await fs.readFile(id);
			return `export default new Uint8Array([${content.join(',')}])`;
		}

		return null;
	},
});
