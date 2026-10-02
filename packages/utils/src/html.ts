/**
 * Reads one HTML opening tag: where it ends, and which attributes it sets.
 *
 * This is not an HTML parser. It does not understand documents, nesting, text
 * content, or closing tags. You give it a string and the position of a `<`
 * inside it, and it reads the single tag that starts at that position.
 *
 * ## Why not use a regular expression
 *
 * The two regular expressions normally written for this job both give wrong
 * answers on valid HTML.
 *
 * The first is used to find where a tag ends, usually written like
 * `/<div\b[^>]*>/`. The `[^>]*` part stops at the first `>` in the string, even
 * when that `>` is inside a quoted attribute value. Given this tag:
 *
 *     <div title="Q1 > Q2" id="chart">
 *
 * the match ends just after `Q1 >`. The tag therefore looks like
 * `<div title="Q1 >`, the `id` attribute is invisible, and code that inserts
 * something directly after the tag inserts it into the middle of the title
 * instead.
 *
 * The second is used to read one attribute, usually written like
 * `/\btitle\s*=\s*(['"])(.*?)\1/`. It searches the whole tag, including the
 * inside of other attributes' values. Given this tag:
 *
 *     <div id="example" data-note='write title="x" to set a title'>
 *
 * it reports that the tag sets `title` to `x`. The tag sets no title at all;
 * the text is part of the note.
 *
 * Both mistakes matter most when a tag's attributes decide what a program does,
 * rather than only how something looks. This function avoids both by walking
 * through the tag one character at a time and keeping track of whether it is
 * currently inside a quoted value.
 *
 * ## What it accepts
 *
 * Attribute values may be double-quoted, single-quoted, unquoted, or absent.
 * Attribute names are matched case-insensitively, because HTML treats them that
 * way. A tag that never closes is rejected rather than guessed at.
 *
 * ## Example
 *
 *     const tag = scanOpeningTag('<div title="Q1 > Q2" id="chart">text', 0)
 *
 *     tag.source                    // '<div title="Q1 > Q2" id="chart">'
 *     tag.end                       // 32
 *     tag.attributes.get('title')   // 'Q1 > Q2'
 *     tag.attributes.get('id')      // 'chart'
 */

/**
 * Where one attribute sits inside the html, for callers that rewrite a tag.
 *
 * Rewriting by replacing these bytes keeps every other attribute exactly as it
 * was written, including which quotes it used. Rebuilding a tag from its parsed
 * values instead has to choose a quote character, and choosing wrongly produces
 * invalid HTML: a value written `data-note='say "hi"'` cannot be re-emitted
 * with double quotes without escaping.
 */
export interface AttributeSpan {
	/** Offset of the attribute's first character, which is the start of its name. */
	start: number
	/** One past its last character: the closing quote, or the end of a bare value. */
	end: number
}

export interface OpeningTag {
	/** The tag exactly as written, from the `<` through the `>` that closes it. */
	source: string
	/** The position of the `<`, the same value that was passed in. */
	start: number
	/**
	 * The position just after the closing `>`.
	 *
	 * `html.slice(tag.end)` is everything following the tag, so this is where to
	 * insert content that should come immediately after it.
	 */
	end: number
	/**
	 * The attributes the tag sets, keyed by lowercased attribute name.
	 *
	 * An attribute written without a value, such as `hidden`, maps to the empty
	 * string. HTML defines it that way, so `attributes.has('hidden')` answers
	 * "was it written?" and `attributes.get('hidden')` answers "what does it
	 * say?" without the two disagreeing.
	 *
	 * If the same attribute name appears twice, the first one is kept. Browsers
	 * do the same.
	 */
	attributes: ReadonlyMap<string, string>
	/**
	 * Where each attribute is written, keyed the same way as `attributes`.
	 *
	 * Offsets are into the html that was scanned, not into `source`, so a caller
	 * can splice directly. Present for every attribute, including one written
	 * without a value.
	 */
	spans: ReadonlyMap<string, AttributeSpan>
}

const TAG_NAME_START = /[A-Za-z]/
const WHITESPACE = /\s/
/** An attribute name ends at whitespace, `=`, `/`, or the end of the tag. */
const NAME_END = /[\s/>=]/
/** An unquoted attribute value ends at whitespace or the end of the tag. */
const UNQUOTED_END = /[\s>]/

/**
 * Reads the opening tag that starts at `start`.
 *
 * Returns `null` when there is no opening tag at that position, or when the tag
 * is not complete. There are two such cases.
 *
 * The first is that `start` does not point at an opening tag. An opening tag is
 * a `<` followed immediately by a letter. Without that check, `</div>`,
 * `<!doctype html>`, `<!-- note -->` and a stray `<` in ordinary text are all
 * read as tags, and their words are reported as attribute names — `</div>`
 * would come back as a tag setting an attribute called `div`. The tag's name is
 * not checked any further than the first letter: deciding which elements are
 * interesting is the caller's job.
 *
 * The second is that the tag never closes, either because the string ends
 * before the `>` or because a quoted value is never closed. Returning a partial
 * tag would be worse than returning nothing, because the caller has no way to
 * tell a partial answer from a complete one.
 */
export function scanOpeningTag(html: string, start: number): OpeningTag | null {
	if (html[start] !== '<' || !TAG_NAME_START.test(html[start + 1] ?? '')) return null

	const attributes = new Map<string, string>()
	const spans = new Map<string, AttributeSpan>()

	// Step over the tag name, so that it is not mistaken for an attribute.
	let i = start + 1
	while (i < html.length && !NAME_END.test(html[i])) i++

	// Read one attribute per pass, until the tag closes or the string runs out.
	while (i < html.length) {
		// Skip the space between attributes, and the `/` of a self-closing tag.
		while (i < html.length && (WHITESPACE.test(html[i]) || html[i] === '/')) i++

		if (i >= html.length) break

		if (html[i] === '>') {
			const end = i + 1
			return { source: html.slice(start, end), start, end, attributes, spans }
		}

		const nameStart = i
		while (i < html.length && !NAME_END.test(html[i])) i++
		const name = html.slice(nameStart, i).toLowerCase()

		while (i < html.length && WHITESPACE.test(html[i])) i++

		// No `=` means an attribute written without a value, such as `hidden`.
		if (html[i] !== '=') {
			if (name && !attributes.has(name)) {
				attributes.set(name, '')
				spans.set(name, { start: nameStart, end: nameStart + name.length })
			}
			continue
		}

		i++
		while (i < html.length && WHITESPACE.test(html[i])) i++

		let value: string
		const quote = html[i]

		if (quote === '"' || quote === "'") {
			// Read to the matching quote. Any `>` before it is part of the value,
			// which is the case the plain regular expression gets wrong.
			const valueStart = ++i
			while (i < html.length && html[i] !== quote) i++

			// Running out of string means the quote was never closed, so the tag
			// never closed either. Break out and return null below.
			if (i >= html.length) break

			value = html.slice(valueStart, i)
			i++
		} else {
			const valueStart = i
			while (i < html.length && !UNQUOTED_END.test(html[i])) i++
			value = html.slice(valueStart, i)
		}

		if (name && !attributes.has(name)) {
			attributes.set(name, value)
			spans.set(name, { start: nameStart, end: i })
		}
	}

	return null
}
