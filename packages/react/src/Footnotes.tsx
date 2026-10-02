import type { CSSProperties, PropsWithChildren } from 'react'
import { Template } from './Template'
import type { CounterStyle } from './types'

export interface FootnotesProps {
	/**
	 * The counter style for the note numbers and their inline markers. Defaults to
	 * the document's numbering style, or `decimal`.
	 */
	counterStyle?: CounterStyle
	/**
	 * Restart the numbering on each page, so every page's footer reads 1, 2, 3 rather
	 * than a count that runs the whole document. For a per-page footer in a Layout; the
	 * inline markers renumber to match. Off by default (continuous numbering).
	 */
	restartEachPage?: boolean
	/**
	 * Whether the leading content (a heading, a rule) repeats in every page's footer. On by
	 * default for a per-page Layout footer; an inline endnotes block shows it once. Set `false`
	 * to show a Layout footer's head on its first page only.
	 */
	repeatHead?: boolean
	/** A class name passed through to the wrapping footnotes container. */
	className?: string
	/** An inline style passed through to the wrapping footnotes container. */
	style?: CSSProperties
}

/**
 * The region that collects a page's footnotes, authored as a `<template>` Format
 * fills. In a Layout it is a per-page footer gathering the notes whose markers
 * landed there; in a flow's content it is an endnotes list. Format renders it as an
 * `<aside data-type="footnotes">` holding a `<dl data-type="footnote-entries">`, where
 * each note is a `<dt data-type="footnote-number">` term and a
 * `<dd data-type="footnote-content">` definition; style the list as a grid with your
 * own CSS.
 *
 * Put a heading or rule inside `<Footnotes>` to render it above the generated list,
 * the way a table of contents renders its leading content above the entries:
 *
 * ```tsx
 * <Footnotes>
 *   <h4>Notes</h4>
 * </Footnotes>
 * ```
 *
 * Omit it and Format adds a plain footer to each page that has footnotes.
 */
export function Footnotes({
	counterStyle,
	restartEachPage,
	repeatHead,
	className,
	style,
	children
}: PropsWithChildren<FootnotesProps>) {
	return (
		<Template
			data-type='footnotes'
			data-counter-style={counterStyle}
			data-restart-each-page={restartEachPage ? '' : undefined}
			data-repeat-head={repeatHead === undefined ? undefined : repeatHead ? 'true' : 'false'}
			className={className}
			style={style}>
			{children}
		</Template>
	)
}
