import type { PropsWithChildren } from 'react'
import { Template } from './Template'
import type { CounterStyle } from './types'

interface NumberingRuleBase {
	/**
	 * CSS selector for the elements this rule numbers, e.g. `h2`, `figure figcaption`,
	 * `.step`. Every match advances the counter in document order.
	 */
	match: string
	/**
	 * The counter this rule advances. Defaults to the selector, so a single-tag
	 * rule needs no separate name.
	 */
	counter?: string
	/**
	 * The text inserted into each match, with `{counter}` placeholders. For
	 * example `Figure {figure}: ` or `{chapter:upper-roman}. `. A placeholder may
	 * carry its own style after a colon. When omitted, the rule advances the
	 * counter but inserts nothing — pair it with a <Counter> read.
	 */
	format?: string
	/**
	 * Default `<counter-style>` for placeholders in `format`. Defaults to `decimal`.
	 */
	counterStyle?: CounterStyle
	/**
	 * Where the formatted number goes relative to the matched element:
	 * `before` its content (the default), `after` it, or `none` to only keep the
	 * counter running. To restart a counter under another, declare it with
	 * `<CounterDef resetEach>`; to nest a counter, mark the container `data-scope`.
	 */
	insert?: 'before' | 'after' | 'none'
}

/**
 * `set` and `increment` are mutually exclusive: `set` forces an exact value on
 * each match, `increment` advances. Passing both is a contradiction the type
 * rejects.
 */
export type NumberingRuleProps = NumberingRuleBase &
	(
		| {
				set?: undefined
				/**
				 * How much to advance the counter on each match. Defaults to 1. Set to `0` when a
				 * rule should not advance a counter of its own, e.g. a rule whose only job is to
				 * reset another counter (a nested-list rule that opens a fresh scope for the
				 * counter you read).
				 */
				increment?: number
		  }
		| {
				/** Set the counter to this exact value on each match instead of advancing it. */
				set: number
				increment?: undefined
		  }
	)

export interface NumberingProps {
	/**
	 * The default counter style for every counter the document numbers. Per-rule,
	 * per-Counter, and per-Footnotes styles override it. Defaults to `decimal`.
	 */
	counterStyle?: CounterStyle
}

/**
 * Turns on document-wide numbering. With no children it numbers headings `h1`
 * through `h6` hierarchically — `1`, `1.1`, `1.1.1` — with each level resetting
 * the ones beneath it. Add <NumberingRule> children to number other things or
 * change the format.
 *
 * Numbers are resolved before pages are split, so they stay correct across page
 * breaks where plain CSS counters would reset.
 *
 * ```tsx
 * <Document title="Report">
 *   <Numbering />
 *   ...
 * </Document>
 * ```
 */
export function Numbering({ counterStyle, children }: PropsWithChildren<NumberingProps>) {
	return (
		<Template data-type='numbering' data-counter-style={counterStyle}>
			{children}
		</Template>
	)
}

/**
 * One numbering rule, used as `<NumberingRule>` inside `<Numbering>`. Each rule
 * matches a selector and advances (and optionally inserts) a counter. Add rules
 * to number things beyond the default headings, or to change the heading format.
 */
export function NumberingRule({ match, counter, format, increment, set, counterStyle, insert }: NumberingRuleProps) {
	if (
		typeof process !== 'undefined' &&
		process.env?.NODE_ENV !== 'production' &&
		set !== undefined &&
		increment !== undefined
	) {
		console.error(
			'<NumberingRule>: `set` and `increment` are mutually exclusive; `set` forces an exact value and wins, `increment` is ignored.'
		)
	}
	return (
		<Template
			data-type='numbering-rule'
			data-match={match}
			data-counter={counter}
			data-format={format}
			data-increment={increment}
			data-set={set}
			data-counter-style={counterStyle}
			data-insert={insert}
		/>
	)
}

export interface CounterDefProps {
	/** The counter this defines. Shared by name across the document. */
	name: string
	/**
	 * The counter this one restarts under, if any: whenever that owner advances, this
	 * counter returns to 0. A `figure` set to restart under `chapter` reads "Figure 2.1".
	 * The restart cascades, so a new chapter zeros section and, under section, figure.
	 */
	resetEach?: string
}

/**
 * Declares one counter's behaviour, used as `<CounterDef>` inside `<Numbering>`. Name
 * the counter and, optionally, the owner counter it restarts under. A counter with an
 * owner returns to 0 every time the owner's value changes; one with no owner restarts
 * only when you reset or set it yourself.
 *
 * ```tsx
 * <Numbering>
 *   <CounterDef name="figure" resetEach="chapter" />
 *   <NumberingRule match="figcaption" counter="figure" format="Figure {chapter}.{figure}: " />
 * </Numbering>
 * ```
 */
export function CounterDef({ name, resetEach }: CounterDefProps) {
	return <Template data-type='counter-def' data-name={name} data-reset-each={resetEach} />
}
