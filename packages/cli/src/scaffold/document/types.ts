import type { Framework, SchemaKind, StylingMethod } from '../shared.ts'

export type { StylingMethod }
export { DEFAULT_STYLING } from '../shared.ts'

// The slice of a Format config the scaffold needs. Structural, so Studio's full
// FormatConfig is assignable without importing Studio types.
export interface ScaffoldProjectConfig {
	framework: Framework
	rootDir?: string
}

export type TemplateId = 'blank'

export const DEFAULT_TEMPLATE: TemplateId = 'blank'

// Placeholder for an --empty document's stylesheet. `/* */` parses as a comment in
// every stylesheet syntax a styling method emits (CSS, SCSS, and vanilla-extract's
// TypeScript), so one constant covers them all.
export const EMPTY_STYLESHEET_COMMENT = '/* Your styles go here */\n'

export interface GeneratedFile {
	// Path relative to the document directory, e.g. 'styles.css' or 'data/default.json'.
	path: string
	contents: string
}

export interface MissingDependency {
	name: string
	dev: boolean
}

export interface MissingConfig {
	// What the user needs to add, in plain language.
	description: string
	// An optional snippet showing the config to add.
	example?: string
}

// The honest result of checking whether a styling method can actually build in
// this project. A scaffold writes the per-document files regardless, then reports
// anything project-wide the user still has to wire up themselves.
export interface PrerequisiteReport {
	method: StylingMethod
	satisfied: boolean
	missingDependencies: MissingDependency[]
	missingConfig: MissingConfig[]
	// Human-readable next-steps lines, ready to print or render in a callout.
	steps: string[]
}

export interface CreateDocumentArgs {
	config: ScaffoldProjectConfig
	// Absolute path to the directory containing the Format config file. The
	// documents directory derives from it via the config's rootDir.
	projectRoot: string
	// The final directory name. Callers validate and resolve it first.
	name: string
	styling?: StylingMethod
	// 'blank' today; the seam for seeding from packages/examples later.
	template?: TemplateId
	// Also emit a data/schema.ts alongside the document.
	emitSchema?: boolean
	// Which validation library the emitted schema uses. Defaults to Zod.
	schemaKind?: SchemaKind
	// Page dimensions in CSS pixels for the starter Layout. Default to A4.
	width?: number
	height?: number
	// Parsed JSON for the default data variant. Seeds data/default.json, the
	// inferred schema, and the entry's data type. Defaults to { title: name }.
	data?: unknown
	// Scaffold a minimal skeleton: an empty Layout, an empty stylesheet, and {}
	// data. Overrides styling and schema, which don't apply to an empty document.
	empty?: boolean
}

export interface CreateDocumentResult {
	documentName: string
	// Absolute path to the directory written.
	documentDir: string
	// Paths written, relative to the documents directory.
	filesWritten: string[]
	prerequisites: PrerequisiteReport
}

// How a styling method weaves into the generated entry file. The starter's
// layout styles live wherever the chosen method idiomatically puts them — a
// stylesheet file, a Vue <style> block, or Linaria styled components — never an
// inline <style> tag.
export interface StyleApplication {
	// Import lines for the script region (React .tsx, Vue <script setup>, HTML index.ts).
	imports: string[]
	// Top-level declarations placed before the component (e.g. Linaria styled components).
	declarations: string[]
	// Optional element/component wrapping the title + hint, when a method needs a
	// container to style rather than the bare title and hint.
	wrapperTag?: string
	// The element or component the title renders into. Defaults to 'h1'.
	headingTag: string
	// Literal class on the heading, e.g. Tailwind utilities. Omitted when the
	// heading needs no class (the method styles the bare element).
	headingClass?: string
	// A class-name expression the heading binds instead of a literal, e.g. 'title'
	// for a scoped vanilla-extract style. Takes precedence over headingClass.
	headingClassExpr?: string
	// The element or component the hint renders into. Defaults to 'p'.
	hintTag: string
	// Literal class on the hint, e.g. 'hint'. Omitted when the hint is a styled component.
	hintClass?: string
	// A class-name expression the entry binds instead of a literal, e.g. 'styles.hint'
	// for a scoped CSS Module. Takes precedence over hintClass when set.
	hintClassExpr?: string
	// An extra <style> block appended to a Vue SFC (scoped styles, @import).
	vueStyleBlock?: string
}

export interface ApplyStyleArgs {
	framework: Framework
	documentName: string
	exportName: string
}

export interface StylingStrategy {
	method: StylingMethod
	frameworks: Framework[]
	// The style file(s) this method writes into the document directory. Methods
	// that live inside the entry file (Linaria, Vue scoped) write none.
	files(args: ApplyStyleArgs): GeneratedFile[]
	// The style file(s) for an empty document, when emptying files() would strip
	// something the method needs. Only methods with required boilerplate (Tailwind's
	// directives) implement this; otherwise the caller empties files() directly.
	emptyFiles?(args: ApplyStyleArgs): GeneratedFile[]
	// How this method weaves into the entry file for the given framework.
	apply(args: ApplyStyleArgs): StyleApplication
	// Report any project-wide dependency or config the method still needs.
	checkPrerequisites(args: CheckPrerequisitesArgs): Promise<PrerequisiteReport>
	// Perform idempotent project-wide setup that mutates files outside the document
	// (config, package.json, codegen). Only methods that need it implement this, and
	// callers run it only when the user opted into installs. Panda is the one today.
	setupProject?(args: SetupProjectArgs): Promise<ProjectSetupResult>
}

export interface CheckPrerequisitesArgs {
	config: ScaffoldProjectConfig
	projectRoot: string
}

export interface SetupProjectArgs {
	config: ScaffoldProjectConfig
	projectRoot: string
	// Absolute path to the resolved Format config file, for methods that amend it.
	formatConfigPath: string
	// The documents directory relative to the project root, e.g. 'documents'.
	documentsGlobBase: string
}

export interface ProjectSetupResult {
	method: StylingMethod
	// False when a step failed (e.g. codegen); the document is still written.
	ok: boolean
	// Human-readable lines describing what ran, for logs and diagnostics.
	summary: string[]
}
