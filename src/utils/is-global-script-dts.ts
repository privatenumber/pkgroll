import fs from 'node:fs/promises';

/**
 * Returns true if the given declaration file is a global script: it declares
 * ambient types but has no top-level import/export, so it is not an external
 * module and exports nothing. Using such a file as the entry point of a types
 * build produces an empty chunk (`export { }`).
 *
 * Any failure (TypeScript unavailable, file unreadable) returns false so the
 * caller keeps the current behaviour.
 */
export const isGlobalScriptDts = async (sourcePath: string): Promise<boolean> => {
	try {
		const loader = await import('./local-typescript-loader.js');
		const ts = loader.default;
		const source = await fs.readFile(sourcePath, 'utf8');
		const sourceFile = ts.createSourceFile(
			sourcePath,
			source,
			ts.ScriptTarget.Latest,
			false,
		);
		return !ts.isExternalModule(sourceFile);
	} catch {
		return false;
	}
};
