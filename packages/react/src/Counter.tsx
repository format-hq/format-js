import type { ElementType, HTMLAttributes } from 'react'
import type { CounterStyle } from './types'

interface CounterBase extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
	/**
	 * The counter to read or advance. Counters are created on first use, so any
	 * name works — `figure`, `table`, `step`. The same name shares one running
	 * value across the whole document.
	 */
	name: string
	/**
	 * Read the current value without advancing it. Use this to refer back to a
	 * number you already showed, e.g. "see Figure <Counter name='figure' peek />".
	 */
	peek?: boolean
	/**
	 * Reset the counter to 0 at this point and render nothing — the start of a
	 * fresh run (a new chapter restarting its figures).
	 */
	reset?: boolean
	/**
	 * Join the whole nested chain of this counter with the given separator — the
	 * `counters()` read, for nested lists: `join="."` shows `1.2.1`. Without it,
	 * only the innermost value is shown.
	 */
	join?: string
	/**
	 * HTML tag to render. Defaults to `span`.
	 */
	as?: ElementType
	/**
	 * CSS `<counter-style>` used to format the value — e.g. `decimal`,
	 * `lower-roman`, `upper-alpha`. Defaults to `decimal`.
	 */
	counterStyle?: CounterStyle
}

/**
 * `set` and `by` are mutually exclusive: `set` jumps to an exact value, `by`
 * advances. Passing both is a contradiction the type rejects.
 */
export type CounterProps = CounterBase &
	(
		| {
				set?: undefined
				/** How much to advance by before showing the value. Defaults to 1. */
				by?: number
		  }
		| {
				/** Set the counter to an exact value and show it. */
				set: number
				by?: undefined
		  }
	)

/**
 * A counter whose value survives pagination. Unlike a CSS counter, which resets
 * on every page, this is resolved by Format before pages are split, so the
 * number stays correct wherever the content lands.
 *
 * By default it advances the counter and shows the new value — the usual "this
 * is Figure N" case. `peek` reads without advancing, `set` jumps to a value, and
 * `reset` starts the count over. These three are mutually exclusive; when more
 * than one is set, `reset` wins, then `set`, then `peek`. `by` applies only to
 * the default advance.
 *
 * Give the counter an `id` to make it referenceable. A `<Ref to="that-id" />`
 * then prints the exact value this counter showed, and `<Ref to="that-id" page />`
 * the page it landed on — the same way a heading's id yields its section number.
 */
export function Counter({ name, peek, reset, set, by, join, as: Tag = 'span', counterStyle, ...rest }: CounterProps) {
	if (
		typeof process !== 'undefined' &&
		process.env?.NODE_ENV !== 'production' &&
		set !== undefined &&
		by !== undefined
	) {
		console.error(
			'<Counter>: `set` and `by` are mutually exclusive; `set` jumps to an exact value and wins, `by` is ignored.'
		)
	}
	const action = reset ? 'reset' : set !== undefined ? 'set' : peek ? 'peek' : 'next'
	// data-value seeds both actions: the exact value for `set`, the step size for `next`
	const value = set !== undefined ? set : action === 'next' ? by : undefined

	return (
		<Tag
			data-type='counter'
			data-name={name}
			data-action={action}
			data-value={value}
			data-join={join}
			data-counter-style={counterStyle}
			{...rest}
		/>
	)
}
