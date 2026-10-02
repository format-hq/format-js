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
