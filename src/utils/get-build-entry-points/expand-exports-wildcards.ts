import path from 'node:path';
import type { SrcDistPairInput } from '../../types.js';
import { getDirectoryFiles } from '../get-directory-files.js';
import type { BuildOutput, EntryPointError } from './types.js';

const extensionPattern = /\.[^./]+$/;

/**
 * Extract wildcard match from file path based on pattern
 * @param pathWithoutExtension - File path without extension
 * @param patternParts - Parts between wildcards (e.g., [""] or ["/index", ""])
 * @returns Captured wildcard value, or undefined if no match
 */
const extractWildcardMatch = (
	pathWithoutExtension: string,
	patternParts: string[],
): string | undefined => {
	// Early validation: check if path ends with the last pattern part
	const lastPart = patternParts.at(-1)!;
	if (!pathWithoutExtension.endsWith(lastPart)) {
		return;
	}

	// Detect if this is a path-based pattern (contains '/') or filename-based pattern
	const isPathPattern = patternParts.some(part => part.includes('/'));

	if (isPathPattern) {
		// Path-based patterns: split by '/' and try different segment lengths
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
	} else {
		// Filename-based patterns: try different character lengths
		// Example: "x.*.y.*" with "foo.y.foo" should capture "foo"
		for (let captureLength = 1; captureLength <= pathWithoutExtension.length; captureLength += 1) {
			const captureValue = pathWithoutExtension.slice(0, captureLength);

			// Build expected pattern by joining parts with the capture value
			const expectedPath = captureValue + patternParts.join(captureValue);
			if (expectedPath === pathWithoutExtension) {
				return expectedPath;
			}
		}
	}
};

export const expandBuildOutputWildcards = async (
	buildOutputs: BuildOutput[],
	srcdistPairs: SrcDistPairInput[],
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

			// Separate directory path from filename prefix
			// Find the last '/' to split directory from filename component
			const lastSlashIndex = outputPrefix.lastIndexOf('/');
			const directoryPrefix = lastSlashIndex === -1
				? outputPrefix
				: outputPrefix.slice(0, lastSlashIndex + 1);
			const filenamePrefix = lastSlashIndex >= 0
				? outputPrefix.slice(lastSlashIndex + 1)
				: '';

			// Helper function to check if a file matches the wildcard pattern
			const matchesPattern = (filePath: string): boolean => {
				// Strip source extension for pattern matching
				const filePathWithoutExtension = filePath.replace(extensionPattern, '');
				const fileName = filePathWithoutExtension.split('/').at(-1) || '';

				// Check filename prefix
				if (filenamePrefix && !fileName.startsWith(filenamePrefix)) {
					return false;
				}

				// For single wildcard patterns, check suffix
				if (patternParts.length === 1) {
					const suffix = patternParts[0];
					if (suffix) {
						// If suffix contains path separators, check against full path
						// Otherwise, check against filename only
						const checkTarget = suffix.includes('/') ? filePathWithoutExtension : fileName;
						if (!checkTarget.endsWith(suffix)) {
							return false;
						}
					}
					return true;
				}

				// For multiple wildcard patterns, use extractWildcardMatch
				// This validates that all wildcards capture the same value
				// For filename patterns with prefix, strip it before matching
				const matchTarget = filenamePrefix
					? fileName.slice(filenamePrefix.length)
					: filePathWithoutExtension;
				return !!extractWildcardMatch(matchTarget, patternParts);
			};

			// Handle root-level patterns (directoryPrefix is './')
			if (directoryPrefix === './') {
				// Expand for each srcdist pair
				const allExpansions = await Promise.all(
					sortedByDistLength.map(async (srcdist) => {
						const srcPath = srcdist.srcResolved;
						const allFiles = await getDirectoryFiles(srcPath);
						return allFiles.flatMap((filePath) => {
							if (!matchesPattern(filePath)) {
								return [];
							}

							// Strip source extension before appending output extension
							const filePathWithoutExtension = filePath.replace(extensionPattern, '');
							return [{
								...output,
								outputPath: srcdist.dist + filePathWithoutExtension + matchedExtension,
							}];
						});
					}),
				);
				return allExpansions.flat();
			}

			// Non-root-level patterns: find matching src:dist pair based on directory prefix
			const srcdistMatch = sortedByDistLength.find(
				({ dist }) => directoryPrefix === dist || directoryPrefix.startsWith(dist),
			);

			if (!srcdistMatch) {
				return [];
			}

			const srcPath = path.posix.join(
				srcdistMatch.srcResolved,
				directoryPrefix.slice(srcdistMatch.dist.length),
			);

			const allFiles = await getDirectoryFiles(srcPath);
			return allFiles.flatMap((filePath) => {
				if (!matchesPattern(filePath)) {
					return [];
				}

				// Strip source extension before appending output extension
				const filePathWithoutExtension = filePath.replace(extensionPattern, '');

				// For multiple wildcard patterns, use the matched path from extractWildcardMatch
				if (patternParts.length > 1) {
					const match = extractWildcardMatch(filePathWithoutExtension, patternParts);
					return [{
						...output,
						outputPath: directoryPrefix + match + matchedExtension,
					}];
				}

				// For single wildcard patterns, preserve the full relative path
				return [{
					...output,
					outputPath: directoryPrefix + filePathWithoutExtension + matchedExtension,
				}];
			});
		}),
	);

	return expandedResults.flat();
};
