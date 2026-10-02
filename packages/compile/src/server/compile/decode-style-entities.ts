/**
 * Decode HTML entities inside <style> tag contents in an HTML string.
 *
 * Some SSR renderers escape text nodes inside <style> (notably React 18 and Vue SSR),
 * which can produce invalid CSS when consuming the HTML as a string.
 */

// Decodes ONLY the HTML entities that React 18 SSR + Vue 3 SSR can introduce in
// <style> (text nodes), and nothing else.
//
// React 18:  &quot; &amp; &lt; &gt; &#x27;
// Vue 3:     &quot; &amp; &lt; &gt; &#39;
// (We also handle a couple equivalent apostrophe forms for robustness.)
const REACT_VUE_ENTITY_RE = /&(quot|amp|lt|gt);|&#(?:x27|39);|&#x0*27;|&#0*39;/gi

export function decodeReactVueStyleEntities(input: any) {
	if (input == null) return input
	const str = String(input)
	// Fast path
	if (!str.includes('&')) return str

	return str.replace(REACT_VUE_ENTITY_RE, (_m: string, named?: string) => {
		// Named entities
		if (named) {
			switch (named.toLowerCase()) {
				case 'quot':
					return '"'
				case 'amp':
					return '&'
				case 'lt':
					return '<'
				case 'gt':
					return '>'
			}
		}

		// Numeric apostrophe entities (React/Vue forms)
		// m could be: &#x27; &#39; plus zero-padded variants we allowed.
		return "'"
	})
}

export function decodeStyleEntities(html: string): string {
	return html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open: string, cssText: string, close: string) => {
		return `${open}${decodeReactVueStyleEntities(cssText)}${close}`
	})
}

export default decodeStyleEntities
