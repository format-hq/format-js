import { RESERVED_WORDS, getDocumentExportName } from './document-names.ts'

// A document compiles to its own `<name>/` dir at the bundle root, so its name
// can't collide with a reserved output dir (Studio's shared-assets and chunks
// output directories).
// Compiled bundles emit `shared-assets/` and `chunks/` at the bundle root, so
// documents can't take those names. Keep in step with the copy in Studio's
// compile constants (apps/studio/src/server/compile/constants.ts) — Studio
// can't import this module from there without bundling scaffold code into
// compiled documents.
export const RESERVED_DOCUMENT_NAMES = ['shared-assets', 'chunks']

// Letters, digits, and hyphens. Kebab-case is the recommended convention, but a
// single word or camelCase also coerces cleanly to a safe export name.
const ALLOWED_NAME = /^[A-Za-z0-9-]+$/

interface ValidateDocumentNameArgs {
	name: string
	existingNames: string[]
}

export type ValidateDocumentNameResult = { ok: true } | { ok: false; reason: string; suggestion?: string }

// Rejects, rather than coerces, an invalid document name. The same rule set
// powers the CLI (reject + reprompt), the endpoint (400 with the reason), and
// the modal (inline field error).
export function validateDocumentName(args: ValidateDocumentNameArgs): ValidateDocumentNameResult {
	const { name, existingNames } = args
	const trimmed = name.trim()

	if (!trimmed) {
		return { ok: false, reason: 'Enter a document name.' }
	}

	if (!ALLOWED_NAME.test(trimmed)) {
		return {
			ok: false,
			reason:
				"Document names shouldn't use spaces or non-alphanumeric characters. Use letters, numbers and dashes only."
		}
	}

	if (RESERVED_DOCUMENT_NAMES.includes(trimmed)) {
		return {
			ok: false,
			reason: `"${trimmed}" is a reserved name. Reserved names: ${RESERVED_DOCUMENT_NAMES.join(', ')}.`
		}
	}

	const exportName = getDocumentExportName(trimmed)

	if (RESERVED_WORDS.has(exportName.toLowerCase())) {
		return {
			ok: false,
			reason: `"${trimmed}" maps to the reserved identifier "${exportName}". Pick a different name.`
		}
	}

	if (existingNames.includes(trimmed)) {
		return {
			ok: false,
			reason: `A document named "${trimmed}" already exists.`,
			suggestion: suggestAvailableName({ name: trimmed, existingNames })
		}
	}

	const exportCollision = existingNames.find(existing => getDocumentExportName(existing) === exportName)

	if (exportCollision) {
		return {
			ok: false,
			reason: `"${trimmed}" and the existing document "${exportCollision}" both map to the export "${exportName}". Document names must resolve to unique exports.`,
			suggestion: suggestAvailableName({ name: trimmed, existingNames })
		}
	}

	return { ok: true }
}

interface SuggestAvailableNameArgs {
	name: string
	existingNames: string[]
}

// Finds the next free name by appending -2, -3, … — used for the conflict UX so
// the CLI and modal both offer "invoice-2" rather than only erroring.
export function suggestAvailableName(args: SuggestAvailableNameArgs): string {
	const { name, existingNames } = args

	const takenNames = new Set(existingNames)
	const takenExports = new Set(existingNames.map(getDocumentExportName))

	const isAvailable = (candidate: string): boolean =>
		!takenNames.has(candidate) && !takenExports.has(getDocumentExportName(candidate))

	if (isAvailable(name)) {
		return name
	}

	// Strip an existing -N suffix so "invoice-2" grows to "invoice-3".
	const base = name.replace(/-\d+$/, '')

	let counter = 2
	while (!isAvailable(`${base}-${counter}`)) {
		counter += 1
	}

	return `${base}-${counter}`
}
