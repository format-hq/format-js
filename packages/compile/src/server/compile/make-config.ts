import type { FormatConfig } from '../../shared/types/public/config'
import type { UserConfig, PluginOption, SSRTarget } from 'vite'
import type { PreRenderedAsset, PreRenderedChunk, LogLevel as RollupLogLevel, RollupLog } from 'rolldown'
import type { AssetMode, NormalizedCompileOptions, Format } from '../../shared/types/public/compile'
import type { BuildDocument } from './build-entry-module'

import { buildDocumentEntryModule } from './build-entry-module'

import { extname } from 'node:path'
import { createRequire } from 'node:module'
import { shouldDecodeStyleEntities } from '../utils/dependencies'
import { engineDefines } from './engine-target'
import { expandTransitiveDependencyClosure } from './dependency-closure'

import adaptorReactNode from './generated/adaptorReactNode.mjs?raw'
import adaptorReactBrowser from './generated/adaptorReactBrowser.mjs?raw'
import adaptorVueNode from './generated/adaptorVueNode.mjs?raw'
import adaptorVueBrowser from './generated/adaptorVueBrowser.mjs?raw'
import adaptorHtml from './generated/adaptorHtml.mjs?raw'
import createRenderer from './generated/createRenderer.mjs?raw'
import decodeStyleEntitiesModule from './generated/decodeStyleEntities.mjs?raw'
import sanitizeHtml from './generated/sanitizeHtml.mjs?raw'
import virtualStyles from './generated/virtualStyles.mjs?raw'
import validate from './generated/validate.mjs?raw'

const VIRTUAL_STYLES_MODULE_ID = 'virtual:styles'
const VIRTUAL_DECODE_STYLE_ENTITIES_MODULE_ID = 'virtual:decode-style-entities'
const VIRTUAL_SANITIZE_HTML_MODULE_ID = 'virtual:sanitize-html'
const VIRTUAL_ENTRY_PREFIX = 'virtual:entry:'
const VIRTUAL_ADAPTOR_MODULE_ID = 'virtual:adaptor'
const VIRTUAL_VALIDATE_MODULE_ID = 'virtual:validate'
const VIRTUAL_CREATE_RENDERER_PREFIX = 'virtual:create-renderer:'
const ROLLDOWN_RUNTIME_CHUNK_RE = /^chunks\/rolldown-runtime-.*\.js$/
const ROLLDOWN_REQUIRE_LINE_RE = /var __require = \/\* @__PURE__ \*\/ createRequire\(import\.meta\.url\);/g
const WEBPACK_COMPAT_REQUIRE_LINE =
	'var __require = typeof process !== "undefined" && typeof process.getBuiltinModule === "function" ? process.getBuiltinModule("module").createRequire(import.meta.url) : /* @__PURE__ */ createRequire(import.meta.url);'

function makeExternalPredicate(
	externalArr: string[]
): (id: string, parentId?: string, isResolved?: boolean) => boolean {
	if (externalArr.length === 0) {
		return () => false
	}

	return (id: string) => {
		return externalArr.some(external => {
			if (id === external) return true
			// Match subpaths: e.g 'react-dom' matches 'react-dom/client'
			if (id.startsWith(external + '/')) return true
			return false
		})
	}
}

function getAdaptor(framework: string, frameworkIsBundled: boolean): string {
	if (framework === 'html') return adaptorHtml

	if (framework === 'react') {
		return frameworkIsBundled ? adaptorReactBrowser : adaptorReactNode
	}

	return frameworkIsBundled ? adaptorVueBrowser : adaptorVueNode
}

type Target = 'node' | 'browser' | 'worker'

type BuildConfigInput = {
	documents: BuildDocument[]
	outDir: string
	compiledFileName: string
	target: Target
	source: 'cli' | 'unplugin'
	plugins: PluginOption[]
	shouldMinify: boolean
	format: Format
	logger: { [K in RollupLogLevel]: (log: RollupLog) => void }
	emittedAssetsDir: string
	assetMode: AssetMode
	options: NormalizedCompileOptions
	config: FormatConfig
	forceExternalFramework?: boolean
}

/**
 * Resolved absolute path to the zip module the compiled wrapper imports its
 * helpers from, for every target and source: the full `@format.dev/zip/web` entry
 * for dynamic mode (it carries node-html-parser for runtime zipping) or the
 * slim `@format.dev/zip/scan` entry for static mode (regex scanner only). Both are
 * fully self-contained ESM (no bare imports to resolve, no node coupling), so
 * our own builds and consumer bundlers (vite, webpack, rollup, esbuild) inline
 * the file as-is — and static bundles never pull the parser.
 */
export function resolveZipModulePath(assetMode: AssetMode): string {
	// `none` wrappers do no asset work, so they import nothing from @format.dev/zip.
	if (assetMode === 'none') {
		return ''
	}

	// Dynamic wrappers call zip() at render time and need the full web entry
	// (it carries node-html-parser). Static wrappers only run the regex
	// known-asset check, so they import the slim scan entry, which has no
	// path to the parser — that keeps node-html-parser in dynamic bundles only.
	const subpath = assetMode === 'dynamic' ? '@format.dev/zip/web' : '@format.dev/zip/scan'

	// require.resolve honours the "require" condition (.cjs); the wrapper is
	// emitted as ESM, so swap to the sibling ESM build we own the layout of.
	return createRequire(import.meta.url)
		.resolve(subpath)
		.replace(/\.cjs$/, '.mjs')
}

export const frameworkPkgs = ['react', 'react-dom', 'vue', 'vue/server-renderer']

type NoExternal = NonNullable<NonNullable<UserConfig['ssr']>['noExternal']>

export function makeViteBuildConfig(i: BuildConfigInput): UserConfig {
	const {
		target,
		source,
		plugins,
		documents,
		compiledFileName,
		outDir,
		shouldMinify,
		format,
		config,
		logger,
		emittedAssetsDir,
		options
	} = i

	// When forceExternalFramework is set (SSR temp builds for asset pre-rendering),
	// framework packages are always kept external regardless of the user's bundle config.
	// Otherwise, the user's config determines whether framework is bundled or external.
	const effectiveBundle = i.forceExternalFramework
		? options.bundle.filter(pkg => !frameworkPkgs.includes(pkg))
		: options.bundle

	const frameworkIsBundled = (() => {
		if (config.framework === 'html') return false

		const primaryPkg = config.framework // 'react' or 'vue'

		if (target === 'node') {
			return effectiveBundle.includes(primaryPkg)
		}

		// Browser and worker bundle framework by default
		return !options.external.includes(primaryPkg)
	})()

	const adaptor = getAdaptor(config.framework, frameworkIsBundled)

	const documentMap = new Map(documents.map(document => [document.name, document]))

	const rendererVirtualPlugin: PluginOption = {
		name: 'plugin:virtual-modules',
		enforce: 'pre',
		resolveId(id) {
			if (id.startsWith(VIRTUAL_ENTRY_PREFIX)) {
				return id
			}

			if (id === VIRTUAL_ADAPTOR_MODULE_ID) {
				return VIRTUAL_ADAPTOR_MODULE_ID
			}

			if (id === VIRTUAL_VALIDATE_MODULE_ID) {
				return VIRTUAL_VALIDATE_MODULE_ID
			}

			if (id === VIRTUAL_STYLES_MODULE_ID) {
				return VIRTUAL_STYLES_MODULE_ID
			}

			if (id === VIRTUAL_DECODE_STYLE_ENTITIES_MODULE_ID) {
				return VIRTUAL_DECODE_STYLE_ENTITIES_MODULE_ID
			}

			if (id === VIRTUAL_SANITIZE_HTML_MODULE_ID) {
				return VIRTUAL_SANITIZE_HTML_MODULE_ID
			}

			if (id.startsWith(VIRTUAL_CREATE_RENDERER_PREFIX)) {
				return id
			}

			return null
		},
		async load(id) {
			if (id.startsWith(VIRTUAL_ENTRY_PREFIX)) {
				const documentName = id.slice(VIRTUAL_ENTRY_PREFIX.length)
				const document = documentMap.get(documentName)

				if (!document) {
					throw new Error(`Unknown document entry "${documentName}"`)
				}

				const createRendererId = `${VIRTUAL_CREATE_RENDERER_PREFIX}${documentName}`
				const entryModule = buildDocumentEntryModule(document, createRendererId, {
					target,
					source,
					assetMode: i.assetMode,
					zipModulePath: resolveZipModulePath(i.assetMode)
				})
				return { code: entryModule }
			}

			if (id === VIRTUAL_ADAPTOR_MODULE_ID) {
				return { code: adaptor }
			}

			if (id === VIRTUAL_VALIDATE_MODULE_ID) {
				return { code: validate }
			}

			if (id === VIRTUAL_STYLES_MODULE_ID) {
				return { code: virtualStyles }
			}

			if (id === VIRTUAL_DECODE_STYLE_ENTITIES_MODULE_ID) {
				if (shouldDecodeStyleEntities({ framework: config.framework })) {
					return { code: decodeStyleEntitiesModule }
				}

				// Stub: always safe to call, doesn't import any deps.
				return {
					code: [
						`export function decodeStyleEntities(html) { return html; }`,
						`export default decodeStyleEntities;`
					].join('\n')
				}
			}

			if (id === VIRTUAL_SANITIZE_HTML_MODULE_ID) {
				return { code: sanitizeHtml }
			}

			if (id.startsWith(VIRTUAL_CREATE_RENDERER_PREFIX)) {
				return { code: createRenderer }
			}

			return null
		}
	}

	const webpackNodeCompatRuntimePlugin: PluginOption =
		target !== 'node' || source !== 'unplugin' || options.userBundler !== 'webpack'
			? null
			: {
					name: 'plugin:webpack-node-compat-runtime',
					renderChunk(code, chunk) {
						if (!ROLLDOWN_RUNTIME_CHUNK_RE.test(chunk.fileName)) {
							return null
						}

						// Webpack-node re-bundles can fail on the rolldown runtime's ESM helper:
						// ```
						// var __require = /* @__PURE__ */ createRequire(import.meta.url);
						// ```
						//
						// We rewrite it to a guarded variant:
						// ```
						// var __require = typeof process !== "undefined" && typeof process.getBuiltinModule === "function"
						//     ? process.getBuiltinModule("module").createRequire(import.meta.url)
						//     : /* @__PURE__ */ createRequire(import.meta.url);
						// ```
						//
						// Also rewrite:
						// ```
						// import { createRequire } from "node:module"
						// ```
						// to:
						// ```
						// import { createRequire } from "module"
						// ```
						let patched = code.replace(/from\s+["']node:module["']/g, 'from "module"')
						patched = patched.replace(ROLLDOWN_REQUIRE_LINE_RE, WEBPACK_COMPAT_REQUIRE_LINE)

						if (patched === code) {
							return null
						}

						return { code: patched, map: null }
					}
				}

	const cwd = config.cwd ? JSON.stringify(config.cwd) : JSON.stringify(process.cwd())

	const conditions = options.conditions.length ? options.conditions : undefined
	const externalConditions = options.externalConditions.length ? options.externalConditions : undefined

	const common: UserConfig = {
		mode: 'production' as const,
		publicDir: false,
		plugins: [
			rendererVirtualPlugin,
			...(webpackNodeCompatRuntimePlugin ? [webpackNodeCompatRuntimePlugin] : []),
			...plugins
		],
		resolve: {
			preserveSymlinks: false,
			conditions
		},
		define: {
			_FMT_VALIDATE_SCHEMA_: JSON.stringify(options.validateSchema),
			_FMT_CWD_: cwd,
			...engineDefines()
		},
		esbuild: {
			jsx: 'automatic',
			jsxDev: false,
			jsxImportSource: 'react'
		}
	}

	const buildCommon = {
		outDir,
		emptyOutDir: false, // very important*
		minify: shouldMinify,
		cssMinify: shouldMinify,
		cssCodeSplit: true
	}

	const rollupInput = Object.fromEntries(
		documents.map(document => [document.name, `${VIRTUAL_ENTRY_PREFIX}${document.name}`])
	)

	const rollupOptions = {
		input: rollupInput,
		preserveEntrySignatures: 'strict' as const,
		treeshake: false, // I'm slightly nervous about treeshaking, so I've gone with false for now.
		output: {
			format,
			entryFileNames: (chunkInfo: PreRenderedChunk) => `${chunkInfo.name}/${compiledFileName}`,
			// styles and rolldown's runtime helpers are one-per-build infrastructure
			// chunks — hashing them would churn consumer output (and goldens) on
			// every toolchain bump for no caching benefit. User-code chunks keep the
			// hashed fallback so same-named dynamic chunks can't collide.
			chunkFileNames: (chunkInfo: PreRenderedChunk) =>
				chunkInfo.name === 'styles' || chunkInfo.name === 'rolldown-runtime'
					? `chunks/${chunkInfo.name}.js`
					: 'chunks/[name]-[hash].js',
			manualChunks: (id: string) => {
				// Force virtual:styles into a shared chunk.
				if (id === VIRTUAL_STYLES_MODULE_ID) {
					return 'styles'
				}
				return undefined
			},
			// Each entry deliberately ships a named export (the document's export
			// name) alongside a default. 'auto' can't pick a CJS shape when both are
			// present and warns (MIXED_EXPORT); 'named' makes the choice explicit and
			// keeps both reachable. Ignored for ES output, so the default ESM build is
			// unaffected.
			exports: 'named' as const,
			assetFileNames: (assetInfo: PreRenderedAsset) => {
				const name = assetInfo.names?.[0] ?? ''
				const ext = extname(name).toLowerCase()
				const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif']
				const fontExtensions = ['.woff', '.woff2', '.ttf', '.otf', '.eot']

				// Images and fonts — the assets a document author references — land in
				// the shared `assets/` dir so they sit in one place rather than split
				// across the outDir root. Images are content-hashed; fonts keep their
				// stable name (their @font-face src references them by it). Everything
				// else (e.g. emitted CSS the styles pipeline keys by its root path)
				// stays at the root, where the rest of the build expects it.
				if (imageExtensions.includes(ext)) {
					return `${emittedAssetsDir}/[name]-[hash][extname]`
				}

				if (fontExtensions.includes(ext)) {
					return `${emittedAssetsDir}/[name][extname]`
				}

				return '[name][extname]'
			}
		},
		onLog: (level: RollupLogLevel, log: RollupLog) => {
			logger[level](log)
		}
	}

	// Framework packages not in the effective bundle list are excluded from
	// the transitive closure so they don't get pulled in as indirect deps.
	const frameworkExclude = frameworkPkgs.filter(pkg => !effectiveBundle.includes(pkg))
	const nodeNoExternal = expandTransitiveDependencyClosure({
		seedPackages: effectiveBundle,
		excludedPackages: frameworkExclude
	})

	// Method: We use a Vite build + SSR configs to bundle for Node.
	// Externals: When bundling for Node, Vite's "SSR" mode defaults
	// to all deps being externalized. The "bundle" option includes
	// deps (including framework packages) in the bundle.
	const node = {
		...common,
		ssr: {
			noExternal: nodeNoExternal,
			resolve: {
				conditions,
				externalConditions
			}
		},
		build: {
			...buildCommon,
			ssr: true,
			ssrEmitAssets: true,
			target: 'esnext' as const,
			rollupOptions
		}
	} satisfies UserConfig

	const workerNoExternal: NoExternal | undefined = options.bundleAll
		? (true as const)
		: options.bundle.length
			? options.bundle
			: undefined

	const workerTarget: SSRTarget = 'webworker'

	// Method: We use a Vite build + SSR configs to bundle for a Worker-like runtime.
	// Externals: Worker builds can bundle all deps by default via presets, but users can still override.
	const worker = {
		...common,
		define: {
			...common.define!,
			'process.env.NODE_ENV': JSON.stringify('production'),
			'process.env': JSON.stringify({}),
			global: 'globalThis'
		},
		ssr: {
			target: workerTarget,
			noExternal:
				workerNoExternal === true
					? true
					: Array.isArray(workerNoExternal)
						? expandTransitiveDependencyClosure({
								seedPackages: workerNoExternal as string[],
								excludedPackages: frameworkPkgs
							})
						: workerNoExternal,
			external: options.external.length ? options.external : undefined,
			resolve: {
				conditions,
				externalConditions
			}
		},
		build: {
			...buildCommon,
			ssr: true,
			ssrEmitAssets: true,
			target: 'esnext' as const,
			rollupOptions
		}
	} satisfies UserConfig

	// Method: We use standard Vite mode to bundle for the browser.
	// Externals: When bundling for the browser, Vite + Rollup default
	// to all deps being bundled. We provide the "external" option
	// to exclude deps from the bundle in this case.
	const browser = {
		...common,
		define: {
			...common.define!,
			'process.env.NODE_ENV': JSON.stringify('production'),
			'process.env': JSON.stringify({}),
			global: 'globalThis'
		},
		build: {
			...buildCommon,
			target: 'baseline-widely-available',
			rollupOptions: {
				...rollupOptions,
				external: makeExternalPredicate(options.external)
			}
		}
	} satisfies UserConfig

	// *emptyOutDir is true by default in vite. For browser bundles, we build
	// an SSR bundle to render HTML for zip and this goes in the same ourDir.
	// So we don't want any automatic outDir emptying/cleansing.

	if (target === 'node') return node
	if (target === 'worker') return worker
	return browser
}
