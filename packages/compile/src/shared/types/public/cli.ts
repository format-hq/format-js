export type CliOptionValueType = 'string' | 'number' | 'boolean' | 'string[]'

export type CliOptionParser = 'comma-separated'

export interface CliOptionSpec {
	field: string
	flags: string
	description: string
	// Doc-only overrides surfaced in the web reference. `summary` overrides the
	// table's one-liner; `see` renders a "Learn more" link in the detail section;
	// `example` renders an Example row (markdown — use inline `code`, not fences).
	summary?: string
	see?: string
	example?: string
	type: CliOptionValueType
	choices?: string[]
	defaultValue?: string | number | boolean | null
	parser?: CliOptionParser
}

export interface CliArgumentSpec {
	name: string
	description: string
	required?: boolean
}

export interface CliCommandSpec {
	name: string
	description: string
	options: CliOptionSpec[]
	// Positional arguments, e.g. `[name]` on `format new document [name]`.
	arguments?: CliArgumentSpec[]
	// Nested subcommands, e.g. `document` under `new`.
	commands?: CliCommandSpec[]
}

export interface CliSpec {
	commands: CliCommandSpec[]
}
