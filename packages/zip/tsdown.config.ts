import { defineConfig } from 'tsdown'

// Independent builds, one per entry. A single multi-entry build lets rolldown
// hoist shared modules into a chunk that both entries load — dragging the full
// Node entry (cheerio, postcss, node:*) into every web-entry consumer.
// Separate builds duplicate ~17KB of shared code and keep the web entry
// genuinely self-contained. ES modules only: the engines floor (>=22.13.0)
// loads ESM through require(), so CommonJS consumers need no .cjs artifact —
// and tsdown fails a CI build that pairs cjs output with such a floor.
export default defineConfig([
	{
		entry: 'src/index.ts',
		format: 'esm',
		outDir: 'dist',
		platform: 'node',
		dts: {
			sourcemap: true
		},
		clean: true
	},
	{
		// noExternal makes web.mjs fully self-contained: compiled document
		// wrappers import it by absolute path from arbitrary consumer bundlers
		// (vite, webpack, rollup, esbuild), which cannot be relied on to resolve
		// our transitive deps from their project root (strict pnpm installs).
		// platform 'neutral' resolves fflate through its `import`/browser export
		// condition (esm/browser.js) — its `node` build pulls a
		// createRequire('module')/worker_threads shim that breaks in browsers.
		// But neutral leaves mainFields empty, so the CJS-only node-html-parser
		// (no `module`/`exports`, only `main`) can't resolve for the ESM output
		// and stays a bare import. resolve.mainFields restores `main` resolution
		// so it inlines into web.mjs too; packages with an `exports` map (fflate,
		// @format.dev/utils) ignore mainFields and keep their condition-based build.
		// node-html-parser and its deps (css-select, he) touch no node:*
		// builtins, so the bundle still runs in browsers and workers.
		// outExtensions keeps the .mjs/.cjs names the exports map declares.
		entry: 'src/web.ts',
		format: 'esm',
		outDir: 'dist',
		platform: 'neutral',
		noExternal: ['fflate', 'node-html-parser', /^@format\.dev\/utils/],
		inputOptions: {
			resolve: {
				mainFields: ['module', 'browser', 'main']
			}
		},
		outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
		dts: {
			sourcemap: true
		},
		clean: false
	},
	{
		// Slim static-mode entry: the regex scanner only, with no path to
		// node-html-parser. Static wrappers import this so the parser ships in
		// dynamic-mode bundles alone. Self-contained like the web entry, for the
		// same reason — consumer bundlers inline it by absolute path.
		entry: 'src/scan.ts',
		format: 'esm',
		outDir: 'dist',
		platform: 'neutral',
		noExternal: [/^@format\.dev\/utils/],
		inputOptions: {
			resolve: {
				mainFields: ['module', 'browser', 'main']
			}
		},
		outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
		dts: {
			sourcemap: true
		},
		clean: false
	}
])
