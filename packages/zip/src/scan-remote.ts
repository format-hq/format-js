import { parseCssRefs, parseHtmlRefs } from './parse'
import { makeScanRemoteRefs } from './scan-core'

/**
 * Every remote (http/https) asset reference in an HTML string: `<img src>`,
 * inline-SVG `<image>`/`<use>` hrefs, `<link rel=stylesheet>` hrefs, and
 * `url()`/`@import` targets in `<style>` blocks and style attributes.
 *
 * Parser-backed (node-html-parser) counterpart to scan-lite's regex
 * `scanRemoteRefs`; both are built from `makeScanRemoteRefs`, so they stay in
 * step. Pure and IO-free — it does not fetch anything. PDF rendering never
 * fetches remote references, so anything this returns will be missing from the
 * output unless it's bundled (see `mergeRemoteAssets`) or removed.
 */
export const scanRemoteRefs = makeScanRemoteRefs({ parseHtmlRefs, parseCssRefs })
