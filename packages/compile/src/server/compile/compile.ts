import { LogLevel, type FormatConfig, type Document } from '../../shared/types'
import type { AssetMode, CompileOptions, NormalizedCompileOptions, Format } from '../../shared/types/public'

import { resolve, dirname } from 'node:path'
import { mkdir, access, rm, readFile, writeFile, readdir } from 'node:fs/promises'
import { builtinModules, createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build, mergeConfig } from 'vite'
import { scanRemoteRefs, mergeRemoteAssets, findBrokenRemoteAssets, AssetMismatchError } from '@format.dev/zip'
import pluralize from 'pluralize'
import grad, { atlas as gradient } from 'gradient-string'

import { getStyles } from '../vite/plugins/get-styles'
import { stylesPreProcessor } from '../vite/plugins/styles-pre-processor'
import { htmlLoader } from '../vite/plugins/html-loader'
import { getSharedAssetsDir, getDocumentsDir, getRootDir, DEFAULT_OUT_DIR_NAME } from '../project/paths'
import { createConfig } from '../vite/create-config'
import { emitPackageJson } from './package-json'
import { getSchemaPath } from '../utils/schema'
import { NO_DOCUMENTS_MESSAGE, DEFAULT_VARIANT } from '../../shared/constants'
import { RenderWorker } from '../render-worker'
import { NO_CONFIG_FILE_MESSAGE } from '../constants'
import { normalizeCompileOptions } from './defaults'
import {
	buildCacheKeyOptions,
	computeCacheHash,
	readCachedHash,
	writeCacheHash,
	cachedOutputsExist
} from './compile-cache'
import { DocumentRenderError } from './render-error'
import { BUNDLE_ENTRY_POINT_FILE_NAME, SHARED_ASSETS_OUT_DIR_NAME, CHUNKS_DIR_NAME } from './constants'
import { createStructuredOutput, type StructuredOutput } from './structured-log'
import { makeViteBuildConfig } from './make-config'
import { basePackageName } from './dependency-closure'
import { compileState } from '../runtime-state'
import { engineTarget } from './engine-target'
import { warnOnLockstepDrift } from '../utils/warn-lockstep'
import { CompileError } from '../errors'
import { bakeWrapperAssetConstants } from './wrapper-source'

import {
	resolveDocumentAssetSources,
	buildDocumentStaticAssets,
	buildDocumentDynamicAssets,
	materialiseSharedDynamicAssets
} from './document-assets'

import { getDocumentDataDir, getDocumentDataFile, getDocuments, getUserDocumentIndex } from '../project/documents'

import {
	logger,
	withPrefixedConsole,
	loadConfig,
	setLogLevel,
	parseLogLevelFromEnv,
	getLogLevel,
	checkDir
} from '../utils'
import { buildDocumentExportMap } from '@format.dev/cli/scaffold'

type CompileSource = 'cli' | 'unplugin'

export function getDefaultOutDir(config: FormatConfig) {
	return resolve(getRootDir(config), DEFAULT_OUT_DIR_NAME)
}

export function getBundleOutDir(config: FormatConfig, outDirOverride?: string | null) {
	return outDirOverride != null ? resolve(outDirOverride) : getDefaultOutDir(config)
}

const assetsFileName = 'assets.zip'

export function getDocumentOutDir(outDir: string, documentName: string) {
	return resolve(outDir, documentName)
}

export function getDocumentEntryPath(outDir: string, documentName: string) {
	return resolve(getDocumentOutDir(outDir, documentName), BUNDLE_ENTRY_POINT_FILE_NAME)
}

export function getDocumentAssetsPath(outDir: string, documentName: string) {
	return resolve(getDocumentOutDir(outDir, documentName), assetsFileName)
}

const INDEX_HTML_FILE_NAME = 'index.html'
const MANIFEST_FILE_NAME = 'manifest.json'

export function getHtmlVariantPath(outDir: string, documentName: string, variant: string) {
	return resolve(getDocumentOutDir(outDir, documentName), variant, INDEX_HTML_FILE_NAME)
}

interface HtmlManifestVariant {
	variant: string
	html: string
}

interface HtmlManifestDocument {
	document: string
	assets?: string
	variants: HtmlManifestVariant[]
}

interface HtmlManifest {
	output: 'html'
	engine: string
	documents: HtmlManifestDocument[]
}

const REMOTE_ASSETS_DOCS_URL = 'https://format.dev/docs/authoring/assets#remote-assets'

/**
 * Post-render remote-reference pass (static mode). PDF generation never
 * fetches remote references at render time, so anything the rendered HTML
 * points at over http(s) must either be fetched into the document's zip now
 * (`remoteAssets` on) or flagged — without it, the reference is missing from
 * every generated PDF.
 */
async function processRemoteAssetRefs(args: {
	html: string
	documentName: string
	outDir: string
	remoteAssets: boolean
}) {
	const { html, documentName, outDir, remoteAssets } = args

	const remoteRefs = scanRemoteRefs(html)

	if (remoteRefs.length === 0) {
		return
	}

	if (!remoteAssets) {
		const list = remoteRefs.map(url => `  • ${url}`).join('\n')

		logger.warn(
			`Document "${documentName}" references remote assets that will be missing from generated PDFs — remote references are never fetched at render time:\n${list}\n` +
				`Compile with --remote-assets to fetch and bundle them, or reference local files instead. ${REMOTE_ASSETS_DOCS_URL}`
		)
		return
	}

	const assetsPath = getDocumentAssetsPath(outDir, documentName)
	const existing = await readFile(assetsPath).catch(() => undefined)

	const merged = await mergeRemoteAssets({ html, zip: existing })

	if (merged && merged !== existing) {
		await mkdir(getDocumentOutDir(outDir, documentName), { recursive: true })
		await writeFile(assetsPath, merged)
		logger.info(`Bundled remote assets referenced by "${documentName}" into its assets.zip`)
	}
}

type BuildDocument = {
	name: string
	entryFilePath: string
	schemaPath?: string
	exportName: string
}

interface CompileBundleArgs {
	documentNames: string[]
	config: FormatConfig
	options: NormalizedCompileOptions
	logLevel: LogLevel
	source: CompileSource
	/** Variant rendered by the node-target smoke test. Defaults to the default variant. */
	smokeVariant?: string
	/** When provided, the smoke render writes each document's rendered HTML here, keyed by name. */
	capturedHtml?: Map<string, string>
	/**
	 * When provided, each document's computed asset state (known set + dynamic URL
	 * map) is written here, keyed by name. The unplugin/Next.js paths read it back
	 * to re-host assets, instead of re-deriving the map from the output on disk.
	 */
	capturedAssetState?: Map<string, DocumentAssetState>
	/** Per-document variant lists to render and write under output: 'html'. */
	htmlVariantMatrix?: Map<string, string[]>
}

export interface DocumentAssetState {
	known: string[]
	urlMap: Record<string, string> | null
}

async function collectExternals(outDir: string, documentNames: string[]): Promise<string[]> {
	const externals = new Set<string>()
	const importRe = /(?:import|from)\s+["']([^./][^"']*)["']/g

	const isNodeBuiltin = (specifier: string) => specifier.startsWith('node:') || builtinModules.includes(specifier)

	const scanFile = async (filePath: string) => {
		try {
			const content = await readFile(filePath, 'utf-8')
			let match

			while ((match = importRe.exec(content)) !== null) {
				const pkg = basePackageName(match[1]!)

				if (!isNodeBuiltin(pkg)) {
					externals.add(pkg)
				}
			}
		} catch {
			// file may not exist
		}
	}

	for (const name of documentNames) {
		await scanFile(resolve(outDir, name, BUNDLE_ENTRY_POINT_FILE_NAME))
	}

	const chunksDir = resolve(outDir, 'chunks')
	const chunkFiles = await readdir(chunksDir).catch(() => [] as string[])

	for (const file of chunkFiles) {
		if (file.endsWith('.js')) {
			await scanFile(resolve(chunksDir, file))
		}
	}

	return [...externals].sort()
}

/**
 * HTML output ships only HTML, each document's `assets.zip`, and the manifest.
 * Remove the JS renderer artefacts left by the node build we rendered from: the
 * per-document wrappers, the bundle index, `package.json`, `externals.json`, the
 * shared chunks, and the root stylesheets (their CSS is already inlined into the
 * rendered HTML).
 */
async function stripJsArtefacts(outDir: string, documents: BuildDocument[]) {
	const removals = documents.map(document => rm(getDocumentEntryPath(outDir, document.name), { force: true }))

	removals.push(
		rm(resolve(outDir, BUNDLE_ENTRY_POINT_FILE_NAME), { force: true }),
		rm(resolve(outDir, 'package.json'), { force: true }),
		rm(resolve(outDir, 'externals.json'), { force: true }),
		rm(resolve(outDir, CHUNKS_DIR_NAME), { recursive: true, force: true })
	)

	const rootEntries = await readdir(outDir, { withFileTypes: true }).catch(() => [])

	for (const entry of rootEntries) {
		const isRootStylesheet = entry.isFile() && entry.name.endsWith('.css')

		if (isRootStylesheet) {
			removals.push(rm(resolve(outDir, entry.name), { force: true }))
		}
	}

	await Promise.all(removals)
}

/**
 * Finalise HTML output: drop the JS artefacts and write the manifest grouping
 * each document's variants with the single shared zip they render from.
 */
async function writeHtmlOutput(args: {
	outDir: string
	buildDocuments: BuildDocument[]
	htmlVariantEntries: Map<string, HtmlManifestVariant[]>
}) {
	const { outDir, buildDocuments, htmlVariantEntries } = args

	await stripJsArtefacts(outDir, buildDocuments)

	const documents: HtmlManifestDocument[] = []

	for (const document of buildDocuments) {
		const variants = htmlVariantEntries.get(document.name) ?? []

		// Checked on disk so a document whose zip came only from remote-asset
		// fetching (no local assets) is still listed correctly.
		const assetsPath = getDocumentAssetsPath(outDir, document.name)
		const hasAssets = await access(assetsPath).then(
			() => true,
			() => false
		)

		documents.push({
			document: document.name,
			...(hasAssets ? { assets: `${document.name}/${assetsFileName}` } : {}),
			variants
		})
	}

	const manifest: HtmlManifest = {
		output: 'html',
		engine: engineTarget,
		documents
	}

	await writeFile(resolve(outDir, MANIFEST_FILE_NAME), JSON.stringify(manifest, null, '\t'), 'utf-8')
}

let cssInJsVmPrewarm: Promise<void> | null = null

/**
 * Pre-warm the module wyw-in-js loads when it evaluates CSS-in-JS.
 *
 * wyw-in-js extracts styles by running each component in a happy-dom VM, and
 * happy-dom loads Node's built-in `node:vm` the first time it builds a window.
 * Rolldown transforms modules in parallel, so two CSS-in-JS files can trigger
 * that load at the same instant — one `require()` then catches `node:vm`
 * mid-`import()` and Node throws "Cannot require() ES Module node:vm because it
 * is not yet fully loaded". Loading the graph once here, sequentially, fills the
 * module cache so the concurrent loads read from it instead of racing the
 * loader. `node:vm` is the module that actually races and is always resolvable;
 * happy-dom is what drags it in, so we warm that too when it resolves through
 * wyw-in-js. Cached so repeat builds in one process pay the cost only once.
 */
function prewarmCssInJsVm(): Promise<void> {
	if (!cssInJsVmPrewarm) {
		cssInJsVmPrewarm = warmCssInJsVm()
	}

	return cssInJsVmPrewarm
}

async function warmCssInJsVm(): Promise<void> {
	await import('node:vm')

	try {
		const requireFromStudio = createRequire(import.meta.url)
		const requireFromVite = createRequire(requireFromStudio.resolve('@wyw-in-js/vite'))
		const requireFromTransform = createRequire(requireFromVite.resolve('@wyw-in-js/transform'))
		const happyDomEntry = requireFromTransform.resolve('happy-dom')

		await import(pathToFileURL(happyDomEntry).href)
	} catch {
		// happy-dom may not resolve (e.g. a wyw-in-js version that no longer bundles
		// it). Warming node:vm above already covers the documented race.
	}
}

async function compileBundle(args: CompileBundleArgs): Promise<StructuredOutput[]> {
	const { documentNames, config, options, logLevel, source } = args
	const { outDir: outDirOverride } = options

	const isBrowserTarget = options.target === 'browser'
	const isWorkerTarget = options.target === 'worker'

	const assetMode: AssetMode = options.assets
	const isHtmlOutput = options.output === 'html'

	const isCli = source === 'cli'
	const isUnplugin = source === 'unplugin'

	logger.debug('Compile bundle context', {
		source,
		target: options.target,
		userBundler: options.userBundler
	})

	const outDir = getBundleOutDir(config, outDirOverride)
	const rootDir = getRootDir(config)

	if (resolve(outDir) === resolve(rootDir)) {
		throw new CompileError(
			'outDir cannot be the same directory as rootDir. Please choose a different output directory before bundling.'
		)
	}

	if (options.clean) {
		await rm(outDir, { recursive: true, force: true })
	}

	await mkdir(outDir, { recursive: true })

	const startTime = performance.now()

	// Never minify bundles for unplugin builds (user's bundler can choose to minify)
	const shouldMinify = isUnplugin ? false : logLevel !== LogLevel.DEBUG

	const exportNames = buildDocumentExportMap(documentNames)
	const buildDocuments: BuildDocument[] = []

	for (const documentName of documentNames) {
		const entryFilePath = await getUserDocumentIndex({ documentName, config })

		try {
			await access(entryFilePath)
		} catch {
			throw new Error(`Entry file not found at ${entryFilePath}`)
		}

		const dataDir = getDocumentDataDir(documentName, config)
		const schemaPath = await getSchemaPath(dataDir)

		if (options.validateSchema && !schemaPath) {
			throw new Error(
				`Schema file not found. Either use --no-validate-schema to disable schema validation or ensure you are using a valid schema file.`
			)
		}

		buildDocuments.push({
			name: documentName,
			entryFilePath,
			schemaPath: schemaPath ?? undefined,
			exportName: exportNames.get(documentName)!
		})
	}

	const { baseViteConfig, frameworkPlugins, stylePlugins } = createConfig()

	// Need fresh plugin instances per build, so state is _not_ cached between builds.
	const makePlugins = () => [
		htmlLoader(),
		stylesPreProcessor(options.inlineRemoteCss),
		...frameworkPlugins,
		...stylePlugins,
		getStyles()
	]

	const format: Format = options.cjs ? 'cjs' : 'es'

	const commonConfig = {
		documents: buildDocuments,
		compiledFileName: BUNDLE_ENTRY_POINT_FILE_NAME,
		shouldMinify,
		format,
		logger,
		emittedAssetsDir: SHARED_ASSETS_OUT_DIR_NAME,
		assetMode,
		config,
		options,
		source
	}

	const buildTarget = isBrowserTarget ? 'browser' : isWorkerTarget ? 'worker' : 'node'

	const buildConfig = makeViteBuildConfig({
		...commonConfig,
		plugins: makePlugins(),
		target: buildTarget,
		outDir
	})

	await prewarmCssInJsVm()

	// All documents build in one Vite pass, so a build error doesn't say which
	// document broke. Best effort: match the failing module's path (or the error
	// message) against each document's directory.
	const findDocumentForBuildError = (error: unknown): string | undefined => {
		const errorShape = error as { id?: unknown; loc?: { file?: unknown }; message?: unknown } | null
		const candidates = [errorShape?.id, errorShape?.loc?.file, errorShape?.message].filter(
			(value): value is string => typeof value === 'string'
		)

		const failing = buildDocuments.find(document =>
			candidates.some(candidate => candidate.includes(dirname(document.entryFilePath)))
		)

		return failing?.name
	}

	try {
		await build(mergeConfig(baseViteConfig, buildConfig))
	} catch (error) {
		const failingDocument = findDocumentForBuildError(error)
		const documentLabel = failingDocument ? ` while building document "${failingDocument}"` : ''

		logger.error(`Vite/Rollup Build Error${documentLabel}:`, error)
		throw error
	}

	await emitPackageJson(outDir, options.bundleName, format, options.version)

	const writeBundleIndex = async (targetOutDir: string, bundleFormat: Format) => {
		const exportNames = buildDocuments.map(doc => doc.exportName)

		if (bundleFormat === 'cjs') {
			const requireLines = buildDocuments.map(doc => {
				const relPath = `./${doc.name}/${BUNDLE_ENTRY_POINT_FILE_NAME}`.replace(/\\/g, '/')
				return `const { ${doc.exportName} } = require(${JSON.stringify(relPath)});`
			})

			const output = [...requireLines, '', `module.exports = { ${exportNames.join(', ')} };`, ''].join('\n')

			await writeFile(resolve(targetOutDir, BUNDLE_ENTRY_POINT_FILE_NAME), output, 'utf8')
			return
		}

		const importLines = buildDocuments.map(doc => {
			const relPath = `./${doc.name}/${BUNDLE_ENTRY_POINT_FILE_NAME}`.replace(/\\/g, '/')
			return `import { ${doc.exportName} } from ${JSON.stringify(relPath)};`
		})
		const output = [
			...importLines,
			'',
			`export { ${exportNames.join(', ')} };`,
			`export default { ${exportNames.join(', ')} };`,
			''
		].join('\n')

		await writeFile(resolve(targetOutDir, BUNDLE_ENTRY_POINT_FILE_NAME), output, 'utf8')
	}

	await writeBundleIndex(outDir, format)

	// Per-document asset bundling. Static mode zips each document's full merged
	// set (shared assets dir + per-doc ./assets/ + Vite-emitted) — no filtering by
	// rendered HTML, so any variant renders from a single zip. Dynamic mode
	// materialises the files next to the bundle and embeds a URL map instead.
	const stagingRoot = resolve(outDir, '__assets_staging')
	const documentAssetState = new Map<string, DocumentAssetState>()

	// Dynamic mode shares one `shared-assets/` dir across documents (the
	// sharedAssetsDir contents + Vite-emitted images and fonts). Materialise it
	// once and reuse its URL map for every document, so nothing is duplicated.
	const sharedDynamicUrlMap =
		assetMode === 'dynamic'
			? await materialiseSharedDynamicAssets({ config, outDir, sharedAssetsOutDirName: SHARED_ASSETS_OUT_DIR_NAME })
			: {}

	// Each document's staging dir and output dir are its own, so documents
	// materialise in parallel.
	const materialiseDocumentAssets = async (document: BuildDocument): Promise<DocumentAssetState> => {
		if (assetMode === 'none') {
			return { known: [], urlMap: null }
		}

		const sources = await resolveDocumentAssetSources({
			entryFilePath: document.entryFilePath,
			config,
			outDir,
			sharedAssetsOutDirName: SHARED_ASSETS_OUT_DIR_NAME
		})

		if (assetMode === 'static') {
			const staticAssets = await buildDocumentStaticAssets(sources, resolve(stagingRoot, document.name))

			if (staticAssets.zip) {
				await mkdir(getDocumentOutDir(outDir, document.name), { recursive: true })
				await writeFile(getDocumentAssetsPath(outDir, document.name), staticAssets.zip)
			}

			return { known: staticAssets.known, urlMap: null }
		}

		const dynamicAssets = await buildDocumentDynamicAssets({
			documentAssetsDir: sources.documentAssetsDir,
			documentOutDir: getDocumentOutDir(outDir, document.name),
			sharedUrlMap: sharedDynamicUrlMap
		})

		return { known: dynamicAssets.known, urlMap: dynamicAssets.urlMap }
	}

	try {
		await Promise.all(
			buildDocuments.map(async document => {
				documentAssetState.set(document.name, await materialiseDocumentAssets(document))
			})
		)
	} finally {
		await rm(stagingRoot, { recursive: true, force: true }).catch(() => {})
	}

	// Bake each document's known-asset set (and dynamic URL map) into its
	// emitted wrapper. No-op for unplugin builds — their wrapper is generated
	// after compile, reading the captured asset state below with the values
	// inlined directly.
	await Promise.all(
		buildDocuments.map(async document => {
			const assetState = documentAssetState.get(document.name)

			if (!assetState) {
				return
			}

			args.capturedAssetState?.set(document.name, assetState)

			await bakeWrapperAssetConstants({
				entryPath: getDocumentEntryPath(outDir, document.name),
				known: assetState.known,
				urlMap: assetState.urlMap
			})
		})
	)

	// `none` ships no asset bundle, but the bundler still content-hashes and
	// emits anything imported as a module. Those imports can't be resolved by
	// name and won't ship in this mode, so warn rather than let them vanish
	// silently. Path references (e.g. `<img src="logo.png">`) are unaffected —
	// the consumer supplies those bytes themselves.
	if (assetMode === 'none') {
		const emittedDir = resolve(outDir, SHARED_ASSETS_OUT_DIR_NAME)
		const emittedEntries = await readdir(emittedDir, { recursive: true, withFileTypes: true }).catch(() => [])
		const emittedCount = emittedEntries.filter(entry => entry.isFile()).length

		if (emittedCount > 0) {
			logger.warn(
				`⚠ --assets none, but the bundle imported ${emittedCount} ${pluralize('asset', emittedCount)} ` +
					`(e.g. \`import logo from './logo.png'\`). Imported assets are content-hashed and managed by the build, ` +
					`so they can't be resolved by name and won't ship in this mode. Reference assets by path ` +
					`(e.g. \`<img src="logo.png">\`) to supply them yourself, or use --assets static or dynamic to bundle them.`
			)
		}
	}

	// Static and none modes don't ship the loose Vite-emitted assets: static
	// folds them into each document's zip, none emits nothing. Either way the
	// shared `shared-assets/` dir is build state, so drop it.
	if (assetMode === 'static' || assetMode === 'none') {
		await rm(resolve(outDir, SHARED_ASSETS_OUT_DIR_NAME), { recursive: true, force: true }).catch(() => {})
	}

	// The remote-reference pass needs rendered HTML, which node-target builds
	// produce at build time: CLI dynamic compiles smoke-render the default
	// variant, and HTML output renders every variant. Both qualify.
	const canProcessRemoteRefs = assetMode === 'static' && options.target === 'node' && (isCli || isHtmlOutput)

	// The mode/target legs of this incompatibility are warned upfront at options
	// normalisation. The one left to surface here is source-dependent, which
	// normalisation can't see: a bundler-driven (unplugin) build never renders at
	// build time, so there is no HTML to fetch remote references from.
	const remoteAssetsBlockedBySource =
		options.remoteAssets && !canProcessRemoteRefs && assetMode === 'static' && options.target === 'node'

	if (remoteAssetsBlockedBySource) {
		logger.warn(
			'remoteAssets was set but cannot be honoured here: fetching remote assets requires a CLI compile, where the document renders at build time. Skipping remote asset fetching.'
		)
	}

	// Node bundles are runnable as-is, so render the real artifact: import each
	// document's emitted wrapper and run it. Dynamic output smoke-renders the
	// default variant (CLI only) to catch broken externals, module-load failures,
	// and default-variant asset mismatches at build time. HTML output renders
	// every selected variant and writes each result to disk — that is its whole
	// artefact, so it runs regardless of source. Browser/worker artifacts can't
	// run here — their failures surface in Studio dev or at the first render.
	const htmlVariantEntries = new Map<string, HtmlManifestVariant[]>()

	if (options.target === 'node' && (isCli || isHtmlOutput)) {
		const renderWorker = new RenderWorker({
			log: msg => logger.debug(msg),
			warn: msg => logger.warn(msg),
			allowedReadPaths: [outDir],
			sandbox: 'strict'
		})

		const smokeVariant = args.smokeVariant ?? DEFAULT_VARIANT

		const enrichWithBrokenRemotes = async (enrichArgs: {
			documentName: string
			mismatch: { missing?: unknown; known?: unknown; remoteRefs?: unknown }
			error: unknown
		}): Promise<unknown> => {
			const { documentName, mismatch, error } = enrichArgs

			const brokenRemote = await findBrokenRemoteAssets({ urls: mismatch.remoteRefs as string[] })

			if (brokenRemote.length === 0) {
				return error
			}

			return new AssetMismatchError({
				documentName,
				mode: assetMode as 'static' | 'dynamic',
				missing: mismatch.missing as string[],
				known: Array.isArray(mismatch.known) ? (mismatch.known as string[]) : [],
				brokenRemote
			})
		}

		const renderVariant = async (document: BuildDocument, variant: string): Promise<string> => {
			const data = await getDocumentDataFile(document.name, variant, config)

			try {
				return await renderWorker.compileRender({
					bundlePath: getDocumentEntryPath(outDir, document.name),
					documentName: document.name,
					data: data || {},
					cwd: getDocumentOutDir(outDir, document.name)
				})
			} catch (error: unknown) {
				logger.error(`Compiled bundle failed to render document "${document.name}" (variant "${variant}")`, error)

				const errData =
					error && typeof error === 'object' && 'data' in error ? (error as { data?: unknown }).data : undefined
				if (errData !== undefined) {
					logger.error('Error data', errData)
				}

				// A local-asset mismatch carries the remote URLs the HTML referenced. When
				// remote assets are in play, probe those too, so one error reports every
				// unresolvable asset — local and remote — not just the local ones.
				const mismatch = error as { missing?: unknown; known?: unknown; remoteRefs?: unknown }
				const isLocalMismatch = Array.isArray(mismatch.missing) && Array.isArray(mismatch.remoteRefs)

				const renderFailure =
					isLocalMismatch && canProcessRemoteRefs && options.remoteAssets
						? await enrichWithBrokenRemotes({ documentName: document.name, mismatch, error })
						: error

				throw new DocumentRenderError({ documentName: document.name, variant, cause: renderFailure })
			}
		}

		try {
			for (const document of buildDocuments) {
				const variants = isHtmlOutput ? (args.htmlVariantMatrix?.get(document.name) ?? []) : [smokeVariant]

				for (const variant of variants) {
					const html = await renderVariant(document, variant)

					// Per variant so the document's shared zip accumulates the union of
					// every variant's remote references — any variant then resolves from it.
					if (canProcessRemoteRefs) {
						await processRemoteAssetRefs({
							html,
							documentName: document.name,
							outDir,
							remoteAssets: options.remoteAssets
						})
					}

					if (!isHtmlOutput) {
						args.capturedHtml?.set(document.name, html)
						continue
					}

					const htmlPath = getHtmlVariantPath(outDir, document.name, variant)
					await mkdir(dirname(htmlPath), { recursive: true })
					await writeFile(htmlPath, html, 'utf-8')

					const entries = htmlVariantEntries.get(document.name) ?? []
					entries.push({ variant, html: `${document.name}/${variant}/${INDEX_HTML_FILE_NAME}` })
					htmlVariantEntries.set(document.name, entries)
				}
			}
		} finally {
			await renderWorker.dispose()
		}
	}

	// HTML output ships rendered HTML, not a runnable bundle, so it writes the
	// manifest and strips the JS artefacts instead of recording externals.
	if (isHtmlOutput) {
		await writeHtmlOutput({ outDir, buildDocuments, htmlVariantEntries })
	}

	if (!isHtmlOutput) {
		const externals = await collectExternals(outDir, documentNames)
		const externalsPayload = { target: options.target, externals }

		await writeFile(resolve(outDir, 'externals.json'), JSON.stringify(externalsPayload, null, '\t'), 'utf-8')

		logger.debug(`Externals for ${options.target}:`, externals.length ? externals.join(', ') : '(none)')
	}

	const endTime = performance.now()
	const compiledIn = `${(endTime - startTime).toFixed(2)}ms`

	const documentName = buildDocuments.length === 1 ? buildDocuments[0]!.name : `${buildDocuments.length} documents`

	const structuredOutput = createStructuredOutput({
		documentName,
		outDir,
		compiledIn
	})

	const currentLogLevel = getLogLevel()
	if (isCli || currentLogLevel === LogLevel.DEBUG) {
		logger.info(
			gradient(`✓ Successfully compiled ${documentName}`),
			'\n',
			JSON.stringify(structuredOutput, null, 2),
			'\n'
		)
	}

	return [structuredOutput]
}

function warnIgnoredOption(message: string) {
	logger.warn(`ℹ ${message}`)
}

/**
 * Map each document to the data variants HTML output should render. Throws on
 * the two unrecoverable cases — a selected document with no data at all, and a
 * requested variant that exists for no document — and warns per document for a
 * requested variant that only some documents have.
 */
export function resolveHtmlVariantMatrix(documents: Document[], requestedVariants: string[]): Map<string, string[]> {
	const documentsWithoutData = documents.filter(document => document.variants.length === 0)

	if (documentsWithoutData.length > 0) {
		const names = documentsWithoutData.map(document => `"${document.name}"`).join(', ')

		throw new CompileError(
			`Can't use --output html for ${names}: no data files found. Add at least a \`data/${DEFAULT_VARIANT}.json\`.`
		)
	}

	const matrix = new Map<string, string[]>()

	if (requestedVariants.length === 0) {
		for (const document of documents) {
			matrix.set(document.name, document.variants)
		}

		return matrix
	}

	const orphanVariants = requestedVariants.filter(
		variant => !documents.some(document => document.variants.includes(variant))
	)

	if (orphanVariants.length > 0) {
		const names = orphanVariants.map(variant => `"${variant}"`).join(', ')

		throw new CompileError(
			`No document has the variant(s) ${names}. Check the names against your \`data/*.json\` files.`
		)
	}

	for (const document of documents) {
		const selected = requestedVariants.filter(variant => document.variants.includes(variant))
		const missing = requestedVariants.filter(variant => !document.variants.includes(variant))

		if (missing.length > 0) {
			const names = missing.map(variant => `"${variant}"`).join(', ')
			logger.warn(`Document "${document.name}" has no variant(s) ${names}; skipping for this document.`)
		}

		matrix.set(document.name, selected)
	}

	return matrix
}

/**
 * HTML output renders from a forced node build with assets bundled at build
 * time, so the JS-bundle and asset-mode flags have nothing to act on. None of
 * them is build-breaking — we override and warn per flag. The genuinely
 * unrecoverable cases (a document with no data, an unknown variant) are errors,
 * raised later in resolveHtmlVariantMatrix.
 */
export function warnIncompatibleHtmlOptions(options: NormalizedCompileOptions) {
	const warnIgnored = (flag: string) =>
		warnIgnoredOption(`The ${flag} flag is not compatible with html output, ignoring.`)

	if (options.target !== 'node') {
		warnIgnored('--target')
	}

	if (options.preset !== 'node') {
		warnIgnored('--preset')
	}

	if (options.assets !== 'static') {
		warnIgnored('--assets')
	}

	if (options.external.length > 0) {
		warnIgnored('--external')
	}

	if (options.bundle.length > 0) {
		warnIgnored('--bundle')
	}

	if (options.conditions.length > 0) {
		warnIgnored('--conditions')
	}

	if (options.externalConditions.length > 0) {
		warnIgnored('--external-conditions')
	}

	if (options.cjs) {
		warnIgnored('--cjs')
	}

	if (options.version) {
		warnIgnored('--version')
	}
}

interface RunCompileArgs {
	/** Raw consumer options; normalised here so every entry point shares one path. */
	options: CompileOptions
	source: CompileSource
	/** Variant the node-target smoke render uses (Studio only). Defaults to the default variant. */
	smokeVariant?: string
	/** Collector the smoke render fills with each document's rendered HTML (Studio only). */
	capturedHtml?: Map<string, string>
	/** Collector filled with each document's asset state (unplugin/Next.js, to re-host assets). */
	capturedAssetState?: Map<string, DocumentAssetState>
}

async function runCompile(runArgs: RunCompileArgs): Promise<StructuredOutput[]> {
	const { options: inputOptions, source, smokeVariant, capturedHtml, capturedAssetState } = runArgs

	setLogLevel(parseLogLevelFromEnv())
	const logLevel = getLogLevel()

	const isCli = source === 'cli'

	// Unplugin builds default to clean: false — the consumer bundler owns the
	// output directory's lifecycle.
	const rawOptions = normalizeCompileOptions(
		source === 'unplugin' ? { ...inputOptions, clean: inputOptions.clean ?? false } : inputOptions
	)

	const isHtmlOutput = rawOptions.output === 'html'

	if (isHtmlOutput) {
		warnIncompatibleHtmlOptions(rawOptions)
	}

	// HTML output has no JS runtime, so the bundle-shaping options are
	// meaningless. Force a node render build with bundled assets; the warning
	// above tells the user which of their flags were dropped.
	const options: NormalizedCompileOptions = isHtmlOutput
		? {
				...rawOptions,
				target: 'node',
				preset: 'node',
				assets: 'static',
				cjs: false,
				external: [],
				bundle: [],
				conditions: [],
				externalConditions: [],
				bundleAll: false
			}
		: rawOptions

	logger.debug('Compile options', options)

	const { documents: documentNames } = options

	const { config } = await loadConfig(options.configPath)

	if (!config) {
		throw new Error(NO_CONFIG_FILE_MESSAGE)
	}

	compileState.setConfig(config)

	const allDocuments = await getDocuments(config)

	const documents = allDocuments
		.filter(({ name }) => documentNames.length === 0 || documentNames.includes(name))
		.sort((a, b) => a.name.localeCompare(b.name))

	const missingDocuments = documentNames.filter(
		name => !allDocuments.some(({ name: documentName }) => documentName === name)
	)

	if (missingDocuments.length > 0) {
		logger.warn(`Couldn't find the following documents: "${missingDocuments.join(', ')}"`)
	}

	if (documents.length === 0) {
		throw new Error(NO_DOCUMENTS_MESSAGE)
	}

	// Fail on export-name collisions before any build work starts — compileBundle
	// would otherwise only hit this after cleaning the output directory.
	buildDocumentExportMap(documents.map(({ name }) => name))

	// The default `assets/` dir is optional, but an explicitly configured one
	// that's missing is a mistake worth failing on.
	if (config.sharedAssetsDir) {
		const sharedAssetsDir = getSharedAssetsDir(config)
		const { isDirectory } = await checkDir(sharedAssetsDir)
		if (!isDirectory) {
			throw new Error(`Your configured \`sharedAssetsDir\` not found or is not a directory: ${sharedAssetsDir}`)
		}
	}

	const htmlVariantMatrix = isHtmlOutput ? resolveHtmlVariantMatrix(documents, options.variants) : undefined

	const outDir = getBundleOutDir(config, options.outDir)

	// CLI and unplugin builds use disk-persisted caching to skip recompilation
	// when nothing changed. HTML output isn't cached: it renders the whole
	// variant matrix and always writes fresh HTML. Dynamic-mode unplugin builds
	// aren't cached either — the plugin needs the per-document asset state a
	// compile captures, and a cache hit would skip capturing it.
	const isCacheableRun = (isCli || (source === 'unplugin' && options.assets !== 'dynamic')) && !isHtmlOutput

	// The consumer bundler only changes compile output through the webpack-node
	// compat rewrite (see make-config), so key on that fact rather than the raw
	// bundler name — vite/rollup/esbuild consumers then share one cached compile.
	const cacheKeyOptions = buildCacheKeyOptions({
		options,
		webpackNodeCompat: options.target === 'node' && source === 'unplugin' && options.userBundler === 'webpack'
	})

	if (isCacheableRun) {
		const documentsDir = getDocumentsDir(config)
		const currentHash = await computeCacheHash(documentsDir, cacheKeyOptions)
		const cachedHash = await readCachedHash(outDir)

		if (cachedHash === currentHash) {
			const expectedEntryPaths = documents.map(({ name }) => getDocumentEntryPath(outDir, name))
			const outputsPresent = await cachedOutputsExist(expectedEntryPaths)

			if (outputsPresent) {
				logger.info('Cache hit — documents unchanged, skipping compile.')
				return []
			}

			logger.debug('Cache hash matched but compiled outputs are missing — recompiling.')
		}
	}

	const runAll = () =>
		compileBundle({
			documentNames: documents.map(({ name }) => name),
			config,
			options,
			logLevel,
			source,
			smokeVariant,
			capturedHtml,
			capturedAssetState,
			htmlVariantMatrix
		})

	const suppressBuildLogs = (_level: string, ...args: unknown[]) => {
		const msg = args.join(' ')

		if (msg.includes('building SSR bundle for production')) return false
		if (msg.includes('rolldown-vite') && msg.includes('building')) return false
		if (msg.includes('built in')) return false

		return true
	}

	const results = isCli
		? ((await withPrefixedConsole(() => runAll(), suppressBuildLogs)) as StructuredOutput[])
		: await runAll()

	// Write cache hash after successful compilation
	if (isCacheableRun) {
		const documentsDir = getDocumentsDir(config)
		const currentHash = await computeCacheHash(documentsDir, cacheKeyOptions)
		await writeCacheHash(outDir, currentHash)
	}

	const { external } = options
	const externalLen = external.length

	if (isCli && externalLen > 0) {
		logger.info(
			`ℹ External packages: ${external.join(', ')}. Make sure ${pluralize('this', externalLen)} ${pluralize(
				'is',
				externalLen
			)} installed where you call render.`
		)
	}

	return results
}

export async function compile(options: CompileOptions): Promise<StructuredOutput[]> {
	await warnOnLockstepDrift(options.configPath ? dirname(options.configPath) : process.cwd())

	return runCompile({ options, source: 'cli' })
		.then(() => process.exit(0))
		.catch(error => {
			logger.error('Compile error', error)
			process.exit(1)
		})
}

export interface StudioCompileOptions {
	/**
	 * Variant the node-target smoke render uses. The download route passes the
	 * variant being downloaded so its remote assets land in the zip and its
	 * rendered HTML comes back ready to send. Defaults to the default variant.
	 */
	variant?: string
}

export interface StudioCompileResult {
	outputs: StructuredOutput[]
	/** Each document's smoke-rendered HTML, keyed by document name. */
	html: Map<string, string>
}

export async function compileForStudio(
	options: CompileOptions,
	studioOptions: StudioCompileOptions = {}
): Promise<StudioCompileResult> {
	const capturedHtml = new Map<string, string>()

	const outputs = await runCompile({ options, source: 'cli', smokeVariant: studioOptions.variant, capturedHtml })

	return { outputs, html: capturedHtml }
}

export async function compileForUnplugin(
	options: CompileOptions,
	extras: { capturedAssetState?: Map<string, DocumentAssetState> } = {}
): Promise<StructuredOutput[]> {
	return runCompile({ options, source: 'unplugin', capturedAssetState: extras.capturedAssetState })
}

export async function compileForTest(options: CompileOptions): Promise<StructuredOutput[]> {
	// Using the Unplugin entrypoint for compile tests, as it's the same as the unplugin process and tests
	return compileForUnplugin(options)
}
