// Check if the property is a valid JavaScript identifier
const isValidIdentifier = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u;

// Check if the property is a reserved word
const reservedWords = new Set([
	'do',
	'if',
	'in',
	'for',
	'int',
	'new',
	'try',
	'var',
	'byte',
	'case',
	'char',
	'else',
	'enum',
	'goto',
	'long',
	'null',
	'this',
	'true',
	'void',
	'with',
	'break',
	'catch',
	'class',
	'const',
	'false',
	'final',
	'float',
	'short',
	'super',
	'throw',
	'while',
	'delete',
	'double',
	'export',
	'import',
	'native',
	'public',
	'return',
	'static',
	'switch',
	'throws',
	'typeof',
	'boolean',
	'default',
	'extends',
	'finally',
	'package',
	'private',
	'abstract',
	'continue',
	'debugger',
	'function',
	'volatile',
	'interface',
	'protected',
	'transient',
	'implements',
	'instanceof',
	'synchronized',
]);

const propertyNeedsQuotes = (
	property: string,
) => !isValidIdentifier.test(property) || reservedWords.has(property);

export const prettyPath = (pathSegments: (string | number)[]) => pathSegments
	.map((segment, index) => {
		if (typeof segment === 'number') {
			return `[${segment}]`;
		}

		if (propertyNeedsQuotes(segment)) {
			return `[${JSON.stringify(segment)}]`;
		}

		if (index > 0) {
			return `.${segment}`;
		}

		return segment;
	})
	.join('');
