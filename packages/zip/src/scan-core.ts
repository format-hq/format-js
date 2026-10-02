import { isLocalOrigin, resolveLocalRef, isRemoteOrigin } from './helpers'

/** Raw url() targets and @import targets pulled from a CSS string, before any resolution. */
export interface CssRefs {
	urls: string[]
	imports: string[]
}

/** Raw asset references found directly in an HTML string, before resolution. */
export interface HtmlRefs {
	imgSrcs: string[]
	svgHrefs: string[]
	linkHrefs: string[]
	inlineCss: string[]
}

/**
 * The parser pair `makeScanAssetRefs` is built on. `scanAssetRefs` binds the
 * dependency-free regex parsers (scan-lite) so the wrapper runtime check stays
 * lean; `zip()` collection binds the node-html-parser parsers (parse.ts). The
 * parity tests pin the two implementations to the same contract.
 */
export interface RefParsers {
	parseHtmlRefs(html: string): HtmlRefs
	parseCssRefs(cssText: string): CssRefs
}

/**
 * Build a `scanAssetRefs(html)` from a parser pair: every local asset reference
 * in the HTML itself, as bundle-root relative paths. Pure and IO-free — it
 * does not follow external stylesheets (that needs a resolver, in `zip()`).
 * Remote (http/https) references are ignored.
 */
export function makeScanAssetRefs(parsers: RefParsers): (html: string) => string[] {
	return html => {
		const { imgSrcs, svgHrefs, linkHrefs, inlineCss } = parsers.parseHtmlRefs(html)
		const refs = new Set<string>()

		const addLocal = (ref: string) => {
			if (!isLocalOrigin(ref)) {
				return
			}

			const local = resolveLocalRef(ref)
			if (local) {
				refs.add(local)
			}
		}

		for (const src of imgSrcs) {
			addLocal(src)
		}

		for (const href of svgHrefs) {
			addLocal(href)
		}

		for (const href of linkHrefs) {
			addLocal(href)
		}

		for (const cssText of inlineCss) {
			const { urls, imports } = parsers.parseCssRefs(cssText)

			for (const url of urls) {
				addLocal(url)
			}

			for (const target of imports) {
				addLocal(target)
			}
		}

		return [...refs]
	}
}

/**
 * Build a `scanRemoteRefs(html)` from a parser pair: every remote (http/https)
 * asset reference in the HTML itself. The mirror of `makeScanAssetRefs` for
 * remote URLs, so the lean (scan-lite) and parser-backed (parse.ts) scanners
 * stay in step. Pure and IO-free — it does not fetch anything.
 */
export function makeScanRemoteRefs(parsers: RefParsers): (html: string) => string[] {
	return html => {
		const { imgSrcs, svgHrefs, linkHrefs, inlineCss } = parsers.parseHtmlRefs(html)
		const refs = new Set<string>()

		const addRemote = (ref: string) => {
			if (isRemoteOrigin(ref)) {
				refs.add(ref)
			}
		}

		for (const src of imgSrcs) {
			addRemote(src)
		}

		for (const href of svgHrefs) {
			addRemote(href)
		}

		for (const href of linkHrefs) {
			addRemote(href)
		}

		for (const cssText of inlineCss) {
			const { urls, imports } = parsers.parseCssRefs(cssText)

			for (const url of urls) {
				addRemote(url)
			}

			for (const target of imports) {
				addRemote(target)
			}
		}

		return [...refs].sort()
	}
}
