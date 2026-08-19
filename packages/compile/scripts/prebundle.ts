/*
Pre-bundles the modules the compile process injects into a user's document as
raw strings via virtual modules. Because they are injected as strings, each must
be a single self-contained file — nothing it imports can be left as a bare
`import` unless the runtime is guaranteed to resolve it.

Two rules follow from that:

  1. Bundle by default. Every dependency is inlined so a strict-pnpm consumer
     (which never hoists Studio's own deps into its node_modules) has nothing to
     resolve. Only the modules in `isExternalModule` stay external.

  2. One file per entry. tsdown/rolldown share chunks across entries by default,
     which breaks the raw-string injection. A separate build per entry plus
     `inlineDynamicImports` forces a single self-contained file each.
*/

import { build, type UserConfig } from 'tsdown'

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { logger } from '../src/server/utils'
import { isExternalModule } from './prebundle-externals'

const _dirname = dirname(fileURLToPath(import.meta.url))

// Bundle everything by default; only the modules in `isExternalModule` are left
// as bare `import`s. Keeping that allowlist small and explicit is the whole
// point: a new transitive dep is inlined automatically instead of silently
// leaking as an unresolvable import in a consumer's project.
const options: UserConfig = {
	outDir: resolve(_dirname, '../src/server/compile/generated'),
	format: 'esm',
	target: 'es2020',
	dts: false,
	sourcemap: false,
	nodeProtocol: true,
	tsconfig: resolve(_dirname, '../tsconfig.json'),
	minify: false, // Don't need to minify as the output will always be re-bundled
	external: (id: string) => isExternalModule(id),
	noExternal: (id: string) => !isExternalModule(id),
	outputOptions: {
		inlineDynamicImports: true
	}
}

const files: Array<Record<string, string>> = [
	{ adaptorHtml: resolve(_dirname, '../src/server/compile/adaptors/html.ts') },
	{ adaptorReactNode: resolve(_dirname, '../src/server/compile/adaptors/react-node.ts') },
	{ adaptorVueNode: resolve(_dirname, '../src/server/compile/adaptors/vue-node.ts') },
	{ adaptorReactBrowser: resolve(_dirname, '../src/server/compile/adaptors/react-browser.ts') },
	{ adaptorVueBrowser: resolve(_dirname, '../src/server/compile/adaptors/vue-browser.ts') },
	{ createRenderer: resolve(_dirname, '../src/server/compile/create-renderer.ts') },
	{ decodeStyleEntities: resolve(_dirname, '../src/server/compile/decode-style-entities.ts') },
	{ sanitizeHtml: resolve(_dirname, '../src/server/compile/sanitize-html.ts') },
	{ virtualStyles: resolve(_dirname, '../src/server/compile/virtual-styles.ts') },
	{ validate: resolve(_dirname, '../src/server/utils/standard-schema-validate.ts') }
]

// The adaptors for HTML and the sanitizer are reused for browser-target compiled
// documents, so both must avoid pulling Node built-ins into their inlined deps.
// A non-`node` platform is how each dep resolves its browser-safe entry:
//
//   - sanitizeHtml (`neutral`): `vfile` reaches for `node:process`/`node:path`/
//     `node:url` only under the `node` export condition. Dropping it lets `vfile`
//     resolve the pure-JS browser shims it already ships (e.g. `cwd: () => '/'`).
//   - adaptorHtml (`browser`): `eta`'s ESM build carries a `fs.readFileSync` path
//     for its file-template API (unused here — we only call `renderString`). Its
//     `browser` export omits `fs` entirely, and `browser` is the only condition
//     that selects it. Pure JS, so the node-target compile keeps working too.
const platformByEntry: Record<string, 'neutral' | 'browser'> = {
	sanitizeHtml: 'neutral',
	adaptorHtml: 'browser'
}

const config: UserConfig[] = files.map(entry => {
	const [name] = Object.keys(entry)
	const platform = platformByEntry[name]

	if (platform) {
		return {
			entry,
			...options,
			platform,
			// A non-`node` platform would otherwise emit `.js`; keep the `.mjs` name
			// the virtual module loader imports.
			outputOptions: { ...options.outputOptions, entryFileNames: '[name].mjs' }
		}
	}

	return {
		entry,
		...options
	}
})

try {
	await Promise.all(config.map(c => build(c)))
} catch (error) {
	// Avoid `process.exit(1)` so a parent runner doesn't occasionally truncate piped stderr output.
	logger.error('Studio prebundle failed.', error)
	process.exitCode = 1
}
