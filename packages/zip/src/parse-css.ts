import type { CssRefs } from './scan-core'

// CSS needs only url() and @import targets — narrow enough that a small,
// comment-stripped tokenizer beats pulling in postcss. Zero dependencies, so
// both the node-html-parser path (parse.ts, used by zip()) and the regex
// scanner (scan-lite.ts, used by the cheap static check) share this one CSS
// implementation without either dragging in the other's HTML parser.

const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g
const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s][^)]*?))\s*\)/gi
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]+?))\s*\)|"([^"]*)"|'([^']*)')/gi

function matchAll(input: string, pattern: RegExp): string[] {
	const out: string[] = []

	for (const match of input.matchAll(pattern)) {
		const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5]

		// keep an empty value (url("")) — the collector reports it as a broken ref;
		// only skip when no capture group matched at all
		if (value != null) {
			out.push(value.trim())
		}
	}

	return out
}

/**
 * Pull every `url(...)` target and every `@import` target out of a CSS string.
 * Comments are stripped first so a commented-out reference is never collected.
 * Pure and IO-free.
 */
export function parseCssRefs(cssText: string): CssRefs {
	const withoutComments = cssText.replace(CSS_COMMENT_RE, '')
	const imports = matchAll(withoutComments, CSS_IMPORT_RE)

	// strip @import statements before scanning url() so an @import url() form
	// isn't counted twice (the full parser separated these by rule type)
	const withoutImports = withoutComments.replace(CSS_IMPORT_RE, '')
	// a bare fragment like url(#gradient) points at an element already in the
	// document (an SVG paint server, clip-path, mask, or filter) so there is no
	// file to bundle
	const urls = matchAll(withoutImports, CSS_URL_RE).filter(ref => !ref.startsWith('#'))

	return { urls, imports }
}
