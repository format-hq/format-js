import type { CSSProperties, ElementType, HTMLAttributes } from 'react'
import type { CounterStyle } from './types'

export interface PageCounterBaseProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
	/**
	 * HTML tag to render. Defaults to `span`. Use `div` (or another block-level
	 * element) when the counter needs its own line.
	 */
	as?: ElementType
	/**
	 * CSS `<counter-style>` used to format the counter — e.g. `decimal`,
	 * `lower-roman`, `upper-alpha`, or a custom `@counter-style` name. Sets
	 * `--page-counter-style` inline; defaults to `decimal` from the base
	 * stylesheet when omitted.
	 */
	counterStyle?: CounterStyle
}

interface PageCounterProps extends PageCounterBaseProps {
	type: 'page-number' | 'page-count'
}

export function PageCounter({ type, as: Tag = 'span', counterStyle, style, ...rest }: PageCounterProps) {
	const mergedStyle: CSSProperties | undefined = counterStyle
		? ({ ...style, '--page-counter-style': counterStyle } as CSSProperties)
		: style
	return <Tag data-type={type} style={mergedStyle} {...rest} />
}
