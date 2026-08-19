// react's attribute order is not guaranteed, so rel and as are matched independently
const IMAGE_PRELOAD_LINK = /<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="image")[^>]*>/g

/**
 * Removes the `<link rel="preload" as="image">` tags that React's server
 * renderer emits ahead of every eager `<img>`. The engine allows a `<link>`
 * only when its `rel` is `stylesheet`, and fails the render with an
 * `INVALID_HTML_LINK_ELEMENT` 400 otherwise.
 */
export function stripImagePreloads(html: string): string {
	return html.replace(IMAGE_PRELOAD_LINK, '')
}

/**
 * Tagged template for authoring CSS, typically inside a `<style>` element.
 * Returns the string from the raw segments, so CSS escapes (`\2014`,
 * icon-font codepoints, escaped selectors) survive intact. Interpolated
 * `null`, `undefined`, and `false` collapse to an empty string for clean
 * conditional rules. The `css` name also lets editors and the Format docs
 * highlighter treat the contents as CSS.
 */
export function css(parts: TemplateStringsArray, ...vals: unknown[]): string {
	let out = parts.raw[0] ?? ''
	for (let i = 0; i < vals.length; i++) {
		const v = vals[i]
		out += (v == null || v === false ? '' : String(v)) + parts.raw[i + 1]!
	}
	return out
}
