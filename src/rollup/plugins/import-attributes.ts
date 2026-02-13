import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'rollup';

// Supports:
// - import html from "./index.html" with { type: "text" }
// - import bytes from "./photo.png" with { type: "bytes" }
// - const bytes = await import("./photo.png", { with: { type: "bytes" } })
//
// Proposals:
// - https://github.com/tc39/proposal-import-attributes (with syntax, Stage 4)
// - https://github.com/tc39/proposal-import-text (type: "text", Stage 2)
// - https://github.com/tc39/proposal-import-bytes (type: "bytes", Stage 2.7)
//
// Note: The import-bytes proposal specifies Uint8Array backed by an immutable ArrayBuffer.
// We produce a mutable Uint8Array because ArrayBuffer.prototype.transferToImmutable()
// is not yet available in stable runtimes (proposal at Stage 2.7).
export const importAttributes = (): Plugin => {
	const attributeTypes = new Map<string, string>();

	return {
		name: 'import-attributes',

		async resolveId(source, importer, { attributes }) {
			if (attributes.type !== 'text' && attributes.type !== 'bytes') {
				return null;
			}

			if (!importer || (!source.startsWith('./') && !source.startsWith('../'))) {
				return null;
			}

			const resolved = path.resolve(path.dirname(importer), source);
			attributeTypes.set(resolved, attributes.type);
			return resolved;
		},

		async load(id) {
			const type = attributeTypes.get(id);
			if (!type) {
				return null;
			}

			this.addWatchFile(id);

			if (type === 'text') {
				const content = await fs.readFile(id, 'utf8');
				return `export default ${JSON.stringify(content)}`;
			}

			if (type === 'bytes') {
				const content = await fs.readFile(id);
				return `export default new Uint8Array([${content.join(',')}])`;
			}

			return null;
		},
	};
};
