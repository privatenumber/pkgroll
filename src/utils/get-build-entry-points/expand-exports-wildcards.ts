import path from 'node:path';
import type { SrcDistPair } from '../../types.js';
import { getDirectoryFiles } from '../get-directory-files.js';
import type { BuildOutput, EntryPointError } from './types.js';

const extensionPattern = /\.[^./]+$/;

/**
 * Extract wildcard match from file path based on pattern
 * @param filePath - File path with extension
 * @param patternParts - Parts between wildcards (e.g., [""] or ["/index", ""])
 * @returns Captured wildcard value, or undefined if no match
 */
const extractWildcardMatch = (
	filePath: string,
	patternParts: string[],
): string | undefined => {
	const pathWithoutExtension = filePath.replace(extensionPattern, '');

	// Early validation: check if path ends with the last pattern part
	const lastPart = patternParts.at(-1)!;
	if (!pathWithoutExtension.endsWith(lastPart)) {
		return;
	}

	// Multiple wildcards: find the repeated capture value by trying different capture lengths
	// Example: "./*" → "./dist/*/*/index.js" with "a/b/a/b/index" captures "a/b"
	// Example: "./*" → "./dist/*/_/*/_/*.mjs" with "foo/_/foo/_/foo" captures "foo"
	const segments = pathWithoutExtension.split('/').filter(Boolean);

	// Try different capture lengths (from 1 segment up to total length)
	for (let captureLength = 1; captureLength <= segments.length; captureLength += 1) {
		const captureValue = segments.slice(0, captureLength).join('/');

		// Build expected pattern by joining parts with the capture value
		const expectedPath = captureValue + patternParts.join(captureValue);
		if (expectedPath === pathWithoutExtension) {
			return expectedPath;
		}
	}
};

export const expandBuildOutputWildcards = async (
	buildOutputs: BuildOutput[],
	srcdistPairs: SrcDistPair[],
): Promise<(BuildOutput | EntryPointError<BuildOutput>)[]> => {
	const sortedByDistLength = Array.from(srcdistPairs).sort((a, b) => b.dist.length - a.dist.length);
	const expandedResults = await Promise.all(
		buildOutputs.map(async (output) => {
			if (
				// Only process exports/imports wildcards (not main/module/types/bin/cli)
				typeof output.source === 'string'
				|| (output.source.path[0] !== 'exports' && output.source.path[0] !== 'imports')

				// Skip non-wildcard entries
				|| !output.outputPath.includes('*')
			) {
				return [output];
			}

			const exportPath = output.source.path[1] as string;
			if (!exportPath.includes('*')) {
				return [output];
			}

			// Extract and validate file extension
			// Handle declaration files (.d.ts, .d.mts, .d.cts) and regular extensions
			const extensionMatch = output.outputPath.match(/\.d\.[cm]?ts$/) || output.outputPath.match(extensionPattern);
			if (!extensionMatch) {
				return [{
					exportEntry: output,
					error: `Wildcard pattern must include a file extension (e.g., ".mjs", ".cjs"). Pattern: ${exportPath}`,
				}];
			}
			const [matchedExtension] = extensionMatch;

			// Remove extension to get the base pattern
			const outputPathWithoutExtension = output.outputPath.slice(0, -matchedExtension.length);

			// Split by wildcards to get prefix and pattern parts
			const [outputPrefix, ...patternParts] = outputPathWithoutExtension.split('*');

			// Find the matching src:dist pair (most specific first)
			const srcdistMatch = sortedByDistLength.find(
				({ dist }) => outputPrefix === dist || outputPrefix.startsWith(dist),
			);

			if (!srcdistMatch) {
				return [];
			}

			const srcPath = path.posix.join(
				srcdistMatch.srcResolved,
				outputPrefix.slice(srcdistMatch.dist.length),
			);
			const allFiles = await getDirectoryFiles(srcPath);
			return allFiles.flatMap((filePath) => {
				const match = extractWildcardMatch(filePath, patternParts);
				if (match) {
					return [{
						...output,
						outputPath: outputPrefix + match + matchedExtension,
					}];
				}

				return [];
			});
		}),
	);

	return expandedResults.flat();
};
