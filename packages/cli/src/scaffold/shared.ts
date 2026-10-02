// Pure data shared between the CLI's scaffolding, Studio's server, and Studio's
// browser app (via re-export shims). Keep it side-effect free with no Node
// imports — it is bundled into the browser.

export type Framework = 'react' | 'vue' | 'html'

export const SUPPORTED_FRAMEWORKS: readonly Framework[] = ['react', 'vue', 'html']

export type StylingMethod =
	| 'css'
	| 'css-modules'
	| 'vue-sfc-scoped'
	| 'scss'
	| 'tailwind'
	| 'linaria'
	| 'vanilla-extract'
	| 'panda-css'

export const DEFAULT_STYLING: StylingMethod = 'css'

export const STYLING_METHODS: StylingMethod[] = [
	'css',
	'css-modules',
	'vue-sfc-scoped',
	'scss',
	'tailwind',
	'linaria',
	'vanilla-extract',
	'panda-css'
]

// Which frameworks each styling method supports. The single source of truth for
// the CLI choices, the modal dropdown, and server-side validation.
export const STYLING_SUPPORT: Record<StylingMethod, Framework[]> = {
	css: ['react', 'vue', 'html'],
	'css-modules': ['react', 'vue'],
	'vue-sfc-scoped': ['vue'],
	scss: ['react', 'vue', 'html'],
	tailwind: ['react', 'vue', 'html'],
	linaria: ['react'],
	'vanilla-extract': ['react'],
	'panda-css': ['react', 'vue']
}

// The npm package(s) each method needs in the user's project. Sass ships with
// Studio, and CSS/Modules/scoped are native, so those are empty. The single
// source for the modal's dep counts and the server's install set.
export const STYLING_DEPENDENCIES: Record<StylingMethod, string[]> = {
	css: [],
	'css-modules': [],
	'vue-sfc-scoped': [],
	scss: [],
	tailwind: ['tailwindcss'],
	linaria: ['@linaria/react', '@linaria/core'],
	'vanilla-extract': ['@vanilla-extract/css'],
	'panda-css': ['@pandacss/dev']
}

export const STYLING_LABELS: Record<StylingMethod, string> = {
	css: 'Plain CSS',
	'css-modules': 'CSS Modules',
	'vue-sfc-scoped': 'Scoped (Vue SFC)',
	scss: 'SCSS',
	tailwind: 'Tailwind',
	linaria: 'Linaria',
	'vanilla-extract': 'Vanilla Extract',
	'panda-css': 'Panda CSS'
}

export function methodsForFramework(framework: Framework): StylingMethod[] {
	return STYLING_METHODS.filter(method => STYLING_SUPPORT[method].includes(framework))
}

export function isStylingMethod(value: string): value is StylingMethod {
	return (STYLING_METHODS as string[]).includes(value)
}

// The schema libraries the CLI scaffolds a starter for. Zod and Valibot are the
// tested core; Joi and Yup are offered too but aren't part of the fixture test
// matrix (see recommended-versions.ts). Format validates against any Standard
// Schema compliant library, so even these are a shortlist, not the limit of
// what works — see the bring-your-own path in the docs.
export type SchemaKind = 'zod' | 'valibot' | 'joi' | 'yup'

export const DEFAULT_SCHEMA_KIND: SchemaKind = 'zod'

export const SCHEMA_KINDS: SchemaKind[] = ['zod', 'valibot', 'joi', 'yup']

export const SCHEMA_LABELS: Record<SchemaKind, string> = {
	zod: 'Zod',
	valibot: 'Valibot',
	joi: 'Joi',
	yup: 'Yup'
}

// The npm package each schema library needs in the user's project. Each exposes
// the Standard Schema `~standard` interface (joi >= 18, yup >= 1.4), which is
// what Format validates against.
export const SCHEMA_DEPENDENCIES: Record<SchemaKind, string> = {
	zod: 'zod',
	valibot: 'valibot',
	joi: 'joi',
	yup: 'yup'
}

export function isSchemaKind(value: string): value is SchemaKind {
	return (SCHEMA_KINDS as string[]).includes(value)
}

export interface PageSize {
	id: string
	name: string
	// Human-friendly dimension label for the chip subtitle.
	label: string
	// Dimensions written to the document, in CSS pixels.
	width: number
	height: number
}

// CSS pixel values from /docs/authoring/page-sizes. Paper sizes convert from
// mm/in at 96dpi; slides are already pixel formats. Every dimension is written
// to 2 decimal places for a uniform column — Prettier always strips trailing
// fraction zeros (816.00 -> 816.0), so prettier-ignore pins the source as typed.
// prettier-ignore
export const PAGE_SIZES: PageSize[] = [
	{ id: 'a3', name: 'A3', label: '297 × 420 mm', width: 1122.52, height: 1587.40 },
	{ id: 'a4', name: 'A4', label: '210 × 297 mm', width: 793.71, height: 1122.52 },
	{ id: 'a5', name: 'A5', label: '148 × 210 mm', width: 559.37, height: 793.71 },
	{ id: 'letter', name: 'US Letter', label: '8.5 × 11 in', width: 816.00, height: 1056.00 },
	{ id: 'slide-16-9', name: 'Slide 16:9', label: '1280 × 720 px', width: 1280.00, height: 720.00 },
	{ id: 'slide-4-3', name: 'Slide 4:3', label: '1024 × 768 px', width: 1024.00, height: 768.00 },
]

export const DEFAULT_PAGE_SIZE_ID = 'a4'

const defaultPageSize = PAGE_SIZES.find(size => size.id === DEFAULT_PAGE_SIZE_ID)

if (!defaultPageSize) {
	throw new Error(`DEFAULT_PAGE_SIZE_ID "${DEFAULT_PAGE_SIZE_ID}" has no matching entry in PAGE_SIZES.`)
}

export const DEFAULT_PAGE_WIDTH = defaultPageSize.width
export const DEFAULT_PAGE_HEIGHT = defaultPageSize.height

export const MAX_PAGE_DIMENSION = 20000

export function isValidDimension(value: number): boolean {
	return Number.isFinite(value) && value > 0 && value <= MAX_PAGE_DIMENSION
}
