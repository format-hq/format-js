/**
 * How a Flow splits content that overflows a page: at a `sentence`, `word`, or
 * `grapheme` boundary, or `none` to keep the block whole and move it to the next
 * page intact. Use the constant (`SplitGranularity.None`) or the plain string
 * (`'none'`); both are accepted.
 */
export const SplitGranularity = {
	Sentence: 'sentence',
	Word: 'word',
	Grapheme: 'grapheme',
	None: 'none'
} as const

export type SplitGranularity = (typeof SplitGranularity)[keyof typeof SplitGranularity]

/**
 * The dot leader between a contents entry's title and its page number. The default,
 * `dots`, draws it; `none` leaves the run between them blank. Use the constant
 * (`TocLeader.None`) or the plain string (`'none'`); both are accepted.
 */
export const TocLeader = {
	Dots: 'dots',
	None: 'none'
} as const

export type TocLeader = (typeof TocLeader)[keyof typeof TocLeader]

/** How a Layout or Flow decides where pages break: `auto` on overflow
 * and at PageBreak markers, `manual` at PageBreak markers only. */
export type PaginationStrategy = 'auto' | 'manual'

/**
 * How the PDF embeds its fonts. Mirrors `FontMode` in `@format.dev/fonts`, which owns
 * the canonical list and the default.
 */
export type FontMode = 'fidelity' | 'compact'

/**
 * A CSS `<counter-style>` name. The predefined styles autocomplete; any custom
 * `@counter-style` name you define is accepted too.
 */
export type CounterStyle =
	| 'decimal'
	| 'decimal-leading-zero'
	| 'lower-roman'
	| 'upper-roman'
	| 'lower-alpha'
	| 'upper-alpha'
	| 'lower-latin'
	| 'upper-latin'
	| 'lower-greek'
	| (string & {})
