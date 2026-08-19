import type { HtmlRefs } from './scan-core'

import { makeScanAssetRefs, makeScanRemoteRefs } from './scan-core'
import { parseCssRefs } from './parse-css'

// The lightweight scanner behind `scanAssetRefs` — the cheap known-asset check
// the compiled wrapper runs at render time. Regex over well-formed,
// quote-attributed HTML (what the Format engine renders), with no parser
// dependency, so static-mode bundles that import only `scanAssetRefs` stay
// lean. zip()'s heavier collection uses node-html-parser (see parse.ts); both
// share one CSS tokenizer (parse-css) and are kept in step by the parity tests.

const IMG_SRC_RE = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
const SVG_REF_TAG_RE = /<(?:image|use)\b[^>]*?\s(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
const LINK_TAG_RE = /<link\b[^>]*>/gi
const HREF_RE = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i
const REL_STYLESHEET_RE = /\srel\s*=\s*(?:"stylesheet"|'stylesheet')/i
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const STYLE_ATTR_RE = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&quot;': '"',
	'&#39;': "'",
	'&lt;': '<',
	'&gt;': '>'
}

// Attribute values come out of the markup entity-encoded; node-html-parser
// decodes them, so the regex scanner must match.
function decodeEntities(value: string): string {
	return value.replace(/&(?:amp|quot|#39|lt|gt);/g, entity => ENTITIES[entity] ?? entity)
}

function matchAll(input: string, pattern: RegExp): string[] {
	const out: string[] = []

	for (const match of input.matchAll(pattern)) {
		const value = match[1] ?? match[2]

		// keep an empty value (src="") — an empty ref is dropped downstream, not
		// here, so both parsers extract the same set (see parse.ts)
		if (value != null) {
			out.push(decodeEntities(value))
		}
	}

	return out
}

/** Regex equivalent of parse.ts's `parseHtmlRefs`. Pure and IO-free. */
function parseHtmlRefs(html: string): HtmlRefs {
	const imgSrcs = matchAll(html, IMG_SRC_RE)

	const svgHrefs = matchAll(html, SVG_REF_TAG_RE).filter(href => !href.startsWith('#'))

	const linkHrefs: string[] = []
	for (const tagMatch of html.matchAll(LINK_TAG_RE)) {
		const tag = tagMatch[0]

		if (!REL_STYLESHEET_RE.test(tag)) {
			continue
		}

		const href = HREF_RE.exec(tag)
		const value = href?.[1] ?? href?.[2]

		// keep an empty href="" (reported downstream); skip only when there is no
		// href match at all
		if (value != null) {
			linkHrefs.push(decodeEntities(value))
		}
	}

	const styleBlocks = [...html.matchAll(STYLE_BLOCK_RE)].map(match => match[1] ?? '')
	const styleAttrs = matchAll(html, STYLE_ATTR_RE)

	return { imgSrcs, svgHrefs, linkHrefs, inlineCss: [...styleBlocks, ...styleAttrs] }
}

/**
 * Scan an HTML string for the local asset references it carries, returning each
 * as a bundle-root relative path. Dependency-free implementation for browser,
 * worker, and edge bundles — same contract as scan.ts's `scanAssetRefs`.
 */
export const scanAssetRefs = makeScanAssetRefs({ parseHtmlRefs, parseCssRefs })

/**
 * Scan an HTML string for the remote (http/https) asset references it carries.
 * Dependency-free counterpart to scan-remote.ts's `scanRemoteRefs`, so the
 * static-mode wrapper can list remote refs without pulling in node-html-parser.
 */
export const scanRemoteRefs = makeScanRemoteRefs({ parseHtmlRefs, parseCssRefs })
