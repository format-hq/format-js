export const RESERVED_WORDS = new Set([
	// Keywords + restricted identifiers from reserved-identifiers (lowercased).
	'await',
	'break',
	'case',
	'catch',
	'class',
	'const',
	'continue',
	'debugger',
	'default',
	'delete',
	'do',
	'else',
	'enum',
	'export',
	'extends',
	'false',
	'finally',
	'for',
	'function',
	'if',
	'import',
	'in',
	'instanceof',
	'new',
	'null',
	'return',
	'super',
	'switch',
	'this',
	'throw',
	'true',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',
	'yield',
	'implements',
	'interface',
	'let',
	'package',
	'private',
	'protected',
	'public',
	'static',
	'arguments',
	'eval',
	// Global properties (lowercased to match toCamelCase output).
	'globalthis',
	'infinity',
	'nan',
	'undefined',
	// TypeScript reserved types.
	'any',
	'bigint',
	'boolean',
	'never',
	'number',
	'object',
	'string',
	'symbol',
	'unknown'
])

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const isReserved = (value: string): boolean => RESERVED_WORDS.has(value.toLowerCase())

function capitalize(value: string): string {
	return value ? value[0].toUpperCase() + value.slice(1) : ''
}

function toCamelCase(input: string): string {
	const normalized = input.trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2')

	const parts = normalized.split(/[^A-Za-z0-9]+/).filter(Boolean)

	if (!parts.length) {
		return 'document'
	}

	const head = parts[0].toLowerCase()
	const tail = parts.slice(1).map(part => capitalize(part.toLowerCase()))

	return `${head}${tail.join('')}` || 'document'
}

function toSafeIdentifier(name: string): string {
	let safe = name

	if (!/^[A-Za-z_$]/.test(safe)) {
		safe = `doc${capitalize(safe)}`
	}

	if (!IDENTIFIER_RE.test(safe) || isReserved(safe)) {
		safe = `doc${capitalize(safe.replace(/[^A-Za-z0-9_$]/g, ''))}`
	}

	if (!IDENTIFIER_RE.test(safe) || isReserved(safe)) {
		safe = 'document'
	}

	return safe
}

export function getDocumentExportName(documentName: string): string {
	return toSafeIdentifier(toCamelCase(documentName))
}

export function buildDocumentExportMap(documentNames: string[]): Map<string, string> {
	const map = new Map<string, string>()
	const used = new Map<string, string>()

	for (const documentName of documentNames) {
		const exportName = getDocumentExportName(documentName)
		const existing = used.get(exportName)

		if (existing) {
			throw new Error(
				`Document names must resolve to unique exports. "${existing}" and "${documentName}" both map to "${exportName}".`
			)
		}

		used.set(exportName, documentName)
		map.set(documentName, exportName)
	}

	return map
}
