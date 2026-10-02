import type { ElementType, HTMLAttributes } from 'react'
import type { CounterStyle } from './types'

export interface RefProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
	/**
	 * The `id` to point at. Put an id on a heading to reference its section number,
	 * or on a `<Counter>` to reference the value that counter printed. The target
	 * can appear anywhere in the document, before or after this reference.
	 */
	to: string
	/**
	 * Read a named counter's value as it stood at the target, e.g. `counter="figure"`
	 * for the figure count at that point in the document. Omit it to show the
	 * target's own number — a heading's section number, or the value a
	 * `<Counter id="…">` printed.
	 */
	counter?: string
	/**
	 * Show the page the target landed on, e.g. "see page 12". Resolved after
	 * pagination. Takes precedence over `counter`.
	 */
	page?: boolean
	/**
	 * HTML tag to render. Defaults to `span`.
	 */
	as?: ElementType
	/**
	 * CSS `<counter-style>` used to format the value. Defaults to `decimal`.
	 */
	counterStyle?: CounterStyle
}

/**
 * A cross-reference to a numbered element — "see Section 2.1" or "Figure 3".
 * Point it at an `id`: a heading's id yields its section number, a `<Counter>`'s
 * id yields the value that counter printed. Add `page` for the page the target
 * landed on, or `counter` to read a named counter's running value at the target.
 *
 * References resolve before pages are split and can point forward to an element
 * that appears later in the document.
 *
 * ```tsx
 * <figcaption>Figure <Counter name="figure" id="flow" />: the data flow</figcaption>
 * // ...anywhere else in the document:
 * <p>The method (see Section <Ref to="method" />) reads Figure <Ref to="flow" />,
 *    shown in full on page <Ref to="flow" page />.</p>
 * ```
 */
export function Ref({ to, counter, page, as: Tag = 'span', counterStyle, ...rest }: RefProps) {
	return (
		<Tag
			data-type='ref'
			data-to={to}
			data-counter={page ? undefined : counter}
			data-page={page ? '' : undefined}
			data-counter-style={counterStyle}
			{...rest}
		/>
	)
}
