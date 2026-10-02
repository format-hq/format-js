// Infers a starter schema and a TypeScript type from a sample data value, so a
// scaffolded document's schema matches the data the author pasted and the entry
// file's `data` prop is typed. The inference is deliberately shallow and forgiving
// — a starting point the author refines, not a complete schema generator.

export type SchemaDialect = 'zod' | 'valibot' | 'yup' | 'joi'

type JsonKind = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'

function kindOf(value: unknown): JsonKind {
	if (value === null) {
		return 'null'
	}

	if (Array.isArray(value)) {
		return 'array'
	}

	if (typeof value === 'object') {
		return 'object'
	}

	if (typeof value === 'number') {
		return 'number'
	}

	if (typeof value === 'boolean') {
		return 'boolean'
	}

	return 'string'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function indent(text: string, tabs: number): string {
	const pad = '\t'.repeat(tabs)
	return text
		.split('\n')
		.map(line => (line ? pad + line : line))
		.join('\n')
}

// A bare object key can be written unquoted; anything else is quoted.
function keyLiteral(key: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

// ── TypeScript type literal ────────────────────────────────────────────────

export function jsonToTsType(value: unknown, depth = 0): string {
	const kind = kindOf(value)

	if (kind === 'string') {
		return 'string'
	}

	if (kind === 'number') {
		return 'number'
	}

	if (kind === 'boolean') {
		return 'boolean'
	}

	if (kind === 'null') {
		return 'null'
	}

	if (kind === 'array') {
		const items = value as unknown[]
		const element = items.length > 0 ? jsonToTsType(items[0], depth) : 'unknown'
		return `${element}[]`
	}

	const entries = Object.entries(value as Record<string, unknown>)

	if (entries.length === 0) {
		return 'Record<string, unknown>'
	}

	const lines = entries.map(([key, child]) => `${keyLiteral(key)}: ${jsonToTsType(child, depth + 1)}`)
	return `{\n${indent(lines.join('\n'), 1)}\n}`
}

// ── Schema expression, per dialect ─────────────────────────────────────────

interface DialectSyntax {
	string: string
	number: string
	boolean: string
	null: string
	unknown: string
	object: (body: string) => string
	array: (element: string) => string
}

const DIALECTS: Record<SchemaDialect, DialectSyntax> = {
	zod: {
		string: 'z.string()',
		number: 'z.number()',
		boolean: 'z.boolean()',
		null: 'z.null()',
		unknown: 'z.unknown()',
		object: body => `z.object(${body})`,
		array: element => `z.array(${element})`
	},
	valibot: {
		string: 'v.string()',
		number: 'v.number()',
		boolean: 'v.boolean()',
		null: 'v.null()',
		unknown: 'v.unknown()',
		object: body => `v.object(${body})`,
		array: element => `v.array(${element})`
	},
	yup: {
		string: 'yup.string()',
		number: 'yup.number()',
		boolean: 'yup.boolean()',
		null: 'yup.mixed()',
		unknown: 'yup.mixed()',
		object: body => `yup.object(${body})`,
		array: element => `yup.array(${element})`
	},
	joi: {
		string: 'Joi.string()',
		number: 'Joi.number()',
		boolean: 'Joi.boolean()',
		null: 'Joi.any()',
		unknown: 'Joi.any()',
		object: body => `Joi.object(${body})`,
		array: element => `Joi.array().items(${element})`
	}
}

export function jsonToSchemaExpr(value: unknown, dialect: SchemaDialect): string {
	const syntax = DIALECTS[dialect]
	const kind = kindOf(value)

	if (kind === 'string') {
		return syntax.string
	}

	if (kind === 'number') {
		return syntax.number
	}

	if (kind === 'boolean') {
		return syntax.boolean
	}

	if (kind === 'null') {
		return syntax.null
	}

	if (kind === 'array') {
		const items = value as unknown[]
		const element = items.length > 0 ? jsonToSchemaExpr(items[0], dialect) : syntax.unknown
		return syntax.array(element)
	}

	const entries = Object.entries(value as Record<string, unknown>)

	if (entries.length === 0) {
		return syntax.object('{}')
	}

	// Object-literal properties must be comma-separated to parse (unlike a TS type
	// literal, where a newline is a valid member separator).
	const lines = entries.map(([key, child]) => `${keyLiteral(key)}: ${jsonToSchemaExpr(child, dialect)}`)
	return syntax.object(`{\n${indent(lines.join(',\n'), 1)}\n}`)
}

// The first top-level string field, used to give the starter a real heading to
// render (e.g. `data.title`). Null when the data has no string field to show.
export function firstStringField(value: unknown): string | null {
	if (!isPlainObject(value)) {
		return null
	}

	for (const [key, child] of Object.entries(value)) {
		if (typeof child === 'string') {
			return key
		}
	}

	return null
}
