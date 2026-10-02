import type { HtmlRefs } from './scan-core'

import { parse } from 'node-html-parser'

// The HTML parser behind zip()'s collection: node-html-parser, real parsing
// that runs in Node and browsers. This is the heavier path and ships only
// where zip() is imported (dynamic-mode wrappers, the public Node entry,
// Studio's server) — never in static-mode bundles, which use the regex scanner
// in scan-lite for their cheap check. CSS is handled by parse-css (shared).

export { parseCssRefs } from './parse-css'

/**
 * Pull raw asset references out of an HTML string with a single parse pass.
 * Pure and IO-free.
 */
export function parseHtmlRefs(html: string): HtmlRefs {
	const root = parse(html)

	// a present-but-empty ref (src="", href="") is kept, not dropped: it names no
	// file, so zip()'s collector reports it as a broken reference. only a
	// genuinely absent attribute (getAttribute returns null/undefined) is filtered
	// out here.
	const imgSrcs = root
		.querySelectorAll('img[src]')
		.map(element => element.getAttribute('src'))
		.filter((src): src is string => src != null)

	// inline-SVG external references: <image href> and <use href>, plus the legacy
	// `xlink:href` form – a bare fragment (e.g. <use href="#icon">) points at an
	// element already in the document, so there is no file to bundle
	const svgHrefs = root
		.querySelectorAll('image, use')
		.map(element => element.getAttribute('href') ?? element.getAttribute('xlink:href'))
		.filter((href): href is string => href != null && !href.startsWith('#'))

	const linkHrefs = root
		.querySelectorAll('link[rel="stylesheet"][href]')
		.map(element => element.getAttribute('href'))
		.filter((href): href is string => href != null)

	const styleBlocks = root.querySelectorAll('style').map(element => element.innerHTML)
	const styleAttrs = root.querySelectorAll('[style]').map(element => element.getAttribute('style') ?? '')

	return { imgSrcs, svgHrefs, linkHrefs, inlineCss: [...styleBlocks, ...styleAttrs] }
}
