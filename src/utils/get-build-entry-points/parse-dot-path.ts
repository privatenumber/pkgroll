/**
 * Parse a dot-path string into an array of segments.
 *
 * Segments are separated by `.`
 * Segments containing special characters must be double-quoted:
 *   exports.".".types → ['exports', '.', 'types']
 *   exports."./utils".types → ['exports', './utils', 'types']
 */
export const parseDotPath = (dotPath: string): string[] => {
	const segments: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < dotPath.length; i += 1) {
		const char = dotPath[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === '.' && !inQuotes) {
			segments.push(current);
			current = '';
		} else {
			current += char;
		}
	}

	segments.push(current);
	return segments;
};
