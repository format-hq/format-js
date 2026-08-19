/**
 * The web and scan entries must be fully self-contained: compiled document
 * wrappers import them by absolute path from arbitrary consumer bundlers,
 * which cannot be relied on to resolve our transitive deps. tsdown's
 * noExternal inlines them, but when it cannot resolve an import (a workspace
 * dist not built yet) it warns, emits a bare external import, and exits
 * zero — which then surfaces only inside a consumer's bundler. Fail the build
 * here instead. The node entry (index.*) is exempt: its externals are real
 * dependencies npm resolves.
 */
import { readFileSync } from 'node:fs'

const bundles = ['dist/web.mjs', 'dist/scan.mjs']

// the packages the config inlines by name; a bare reference to any of them in
// a self-contained bundle means the inlining silently failed
const inlined = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"](?:@format(?:\.dev)?\/|fflate|node-html-parser)/

for (const bundle of bundles) {
	const match = readFileSync(bundle, 'utf8').match(inlined)
	if (match) {
		console.error(
			`${bundle} contains a bare import of an inlined package (${match[0]}...) — ` +
				`the noExternal inlining failed. Build the workspace dists, then rebuild.`
		)
		process.exit(1)
	}
}
