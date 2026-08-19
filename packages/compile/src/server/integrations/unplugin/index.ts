import type { FormatConfig } from '../../../shared/types'
import type { AssetMode, FormatUnpluginOptions, Target } from '../../../shared/types/public'
import type { DocumentAssetState } from '../../compile/compile'

import { dirname, resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { listZipEntries } from '@format.dev/zip'
import { loadConfig } from '../../utils'
import { buildDocumentExportMap } from '@format.dev/cli/scaffold'
import { readFile } from 'node:fs/promises'
import { getDocuments, getUserDocumentIndex } from '../../project/documents'
import { createHash } from 'node:crypto'
import { compileForUnplugin } from '../../compile/compile'
import { logger, setLogLevel } from '../../utils/log'
import { parseLogLevelFromEnv } from '../../utils/env-var'
import { warnOnLockstepDrift } from '../../utils/warn-lockstep'
import { getBundleOutDir } from '../../compile'
import { resolveBundleName } from '../../compile/bundle-name'
import { writeFormatEnvTypes } from '../../project/format-env-types'
import { getUserProjectDir } from '../../project/user-project-dir'
import { BUNDLE_ENTRY_POINT_FILE_NAME } from '../../compile/constants'
import { dynamicAssetEmitEntries } from '../../compile/document-assets'
import { buildWrapperFactorySource } from '../../compile/wrapper-source'
import { resolveZipModulePath } from '../../compile/make-config'
import { DEFAULT_OUT_DIR_NAME } from '../../project/paths'
import { sanitiseSubdir, safeRelPath, cleanId, addZeroPrefix, stripPrefix } from './utils'

export interface CompiledDocument {
	documentName: string
	exportName: string
	assetsPath: string | null
	hash: string
}

function resolveAssetMode(options: FormatUnpluginOptions, config: FormatConfig): AssetMode {
	return options.assets ?? 'static'
}

export interface CompiledBundle {
	outDir: string
	hash: string
	compiledAt: number
	/** Each document's compiled asset state, keyed by name. Empty for static/none. */
	assetState: Map<string, DocumentAssetState>
}

const PLUGIN_NAME = 'format-unplugin'

const DEFAULT_TARGET = 'node'

// User virtual module prefix
// Example: import renderers from 'format:documents'
const VIRTUAL_MODULE_PREFIX = '@format:'

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Internal virtual module, turns into:
// import renderer from 'format:renderer/documents'
// User does not need this
const RENDERER_MODULE = `${VIRTUAL_MODULE_PREFIX}renderer/`

const memoryAssets = new Map<string, Buffer>()

export function buildRendererModuleSource(outDir: string, documents: CompiledDocument[]): string {
	const importLines = documents.map(document => {
		const importPath = `./${document.documentName}/${BUNDLE_ENTRY_POINT_FILE_NAME}`.replace(/\\/g, '/')
		return `import { ${document.exportName} } from ${JSON.stringify(importPath)};`
	})
	const exportNames = documents.map(document => document.exportName)

	return [
		...importLines,
		'',
		`export { ${exportNames.join(', ')} };`,
		`export default { ${exportNames.join(', ')} };`,
		''
	].join('\n')
}

async function getDocumentHash(documentName: string, config: FormatConfig): Promise<string> {
	const hash = createHash('sha256')
	const documentIndexPath = await getUserDocumentIndex({ documentName, config })

	try {
		const content = await readFile(documentIndexPath, 'utf-8')

		hash.update(content)

		return hash.digest('hex').substring(0, 8)
	} catch {
		return 'initial'
	}
}

interface CompileBundleArgs {
	config: FormatConfig
	options: FormatUnpluginOptions
	compiledDocuments: Map<string, CompiledDocument>
	compiledBundle: CompiledBundle | null
	bundler: Bundler
}

type Bundler = 'vite' | 'rollup' | 'esbuild' | 'webpack' | 'rspack'

const compileBundle = async (args: CompileBundleArgs): Promise<CompiledBundle> => {
	const { config, options, compiledDocuments, compiledBundle, bundler } = args

	const documents = await getDocuments(config)
	const documentNames = documents.map(doc => doc.name).sort((a, b) => a.localeCompare(b))

	if (documentNames.length === 0) {
		throw new Error('No documents found to compile.')
	}

	const exportNames = buildDocumentExportMap(documentNames)

	// Keep the project's format-env.d.ts in sync with the current documents.
	// Depends only on the document set, so it runs regardless of the bundle
	// cache below, and no-ops when the contents are unchanged.
	await writeFormatEnvTypes({
		projectRoot: getUserProjectDir(),
		aliases: [`${VIRTUAL_MODULE_PREFIX}${resolveBundleName(options.bundleName)}`],
		documents: documentNames.map(name => ({ exportName: exportNames.get(name)! }))
	})

	const documentHashes = new Map<string, string>()
	for (const documentName of documentNames) {
		const hash = await getDocumentHash(documentName, config)
		documentHashes.set(documentName, hash)
	}

	const bundleHashInput = documentNames.map(name => `${name}:${documentHashes.get(name)}`).join('|')
	const bundleHash = createHash('sha256').update(bundleHashInput).digest('hex').substring(0, 8)

	if (compiledBundle?.hash === bundleHash && compiledDocuments.size === documentNames.length) {
		logger.debug('Format bundle already compiled')
		return compiledBundle
	}

	logger.debug(`Compiling Format bundle: ${documentNames.join(', ')}`)

	const {
		assets,
		validateSchema,
		inlineRemoteCss,
		target,
		outDir: outDirOverride,
		configPath,
		bundleName,
		clean
	} = options

	const compileOptions = {
		documents: documentNames,
		assets,
		validateSchema,
		inlineRemoteCss,
		target,
		configPath,
		outDir: outDirOverride,
		bundleName,
		clean,
		userBundler: bundler
	}

	logger.debug('Passing compile context from unplugin', {
		userBundler: bundler,
		target
	})

	const assetState = new Map<string, DocumentAssetState>()
	await compileForUnplugin(compileOptions, { capturedAssetState: assetState })

	const outDir = getBundleOutDir(config, outDirOverride)

	logger.debug(`Format bundle outDir: ${outDir}`)

	const assetMode = resolveAssetMode(options, config)

	compiledDocuments.clear()
	for (const documentName of documentNames) {
		compiledDocuments.set(documentName, {
			documentName,
			exportName: exportNames.get(documentName)!,
			hash: documentHashes.get(documentName)!,
			assetsPath: assetMode === 'static' ? resolve(outDir, documentName, 'assets.zip') : null
		})
	}

	return {
		outDir,
		hash: bundleHash,
		compiledAt: Date.now(),
		assetState
	}
}

export interface EmitAssetFileArgs {
	emitFile: (asset: { type: 'asset'; fileName: string; source: Buffer }) => void
	buffer: Buffer
	relName: string
	outRoot: string
	assetsSubdir: string
	emittedAssetNames: Set<string>
	bundler: Bundler
}

/**
 * Emit one asset file into the consumer's bundle output. Returns the emitted
 * path relative to the bundler's out dir, or the already-emitted path when a
 * previous document emitted the same file (shared `_imported/` files, fonts).
 */
export async function emitAssetFile(args: EmitAssetFileArgs): Promise<string> {
	const { emitFile, buffer, relName, outRoot, assetsSubdir, emittedAssetNames, bundler } = args

	const root = outRoot || process.cwd()
	const { rel: assetFileName } = safeRelPath(root, assetsSubdir, relName)

	if (emittedAssetNames.has(assetFileName)) {
		logger.debug(`Skip duplicate asset emit: ${assetFileName}`)
		return assetFileName
	}

	if (bundler === 'esbuild') {
		// ESBuild doesn't support emitFile
		const assetAbsPath = resolve(root, assetFileName)
		await mkdir(dirname(assetAbsPath), { recursive: true })
		await writeFile(assetAbsPath, buffer)
		emittedAssetNames.add(assetFileName)
		return assetFileName
	}

	emitFile({
		type: 'asset',
		fileName: assetFileName, // always relative to bundler out dir
		source: buffer
	})

	emittedAssetNames.add(assetFileName)
	return assetFileName
}

function getRegisteredRendererSource(rendererName: string, rendererSourceMap: Map<string, string>): string {
	const source = rendererSourceMap.get(rendererName)

	if (!source) {
		throw new Error(`Renderer source not registered for "${rendererName}"`)
	}

	return source
}

export interface BuildVirtualModuleArgs {
	target: Target
	useZeroPrefix: boolean
	options: FormatUnpluginOptions
	config: FormatConfig
	compiledDocuments: Map<string, CompiledDocument>
	compiledBundle: CompiledBundle | null
	rendererSourceMap: Map<string, string>
	outRoot?: string
	assetsSubdir?: string
	emittedAssetNames: Set<string>
	bundler: Bundler
	virtualModuleName: string
	emitFile: (x: any) => void
	isDevServer: boolean
	bundleName: string
}

export async function buildVirtualModuleCode(args: BuildVirtualModuleArgs): Promise<string | null> {
	const {
		target,
		useZeroPrefix,
		virtualModuleName,
		options,
		config,
		compiledDocuments,
		compiledBundle,
		rendererSourceMap,
		outRoot,
		assetsSubdir,
		emittedAssetNames,
		bundler,
		emitFile,
		isDevServer,
		bundleName
	} = args

	try {
		if (virtualModuleName !== bundleName) {
			throw new Error(
				`Unsupported Format virtual module "${virtualModuleName}". Use "${VIRTUAL_MODULE_PREFIX}${bundleName}".`
			)
		}

		if (!compiledBundle) {
			throw new Error('Format bundle not compiled.')
		}

		const assetMode = resolveAssetMode(options, config)
		const rendererVirtualId = `${RENDERER_MODULE}${bundleName}`
		const documents = [...compiledDocuments.values()].sort((a, b) => a.documentName.localeCompare(b.documentName))
		const rendererSource = buildRendererModuleSource(compiledBundle.outDir, documents)

		rendererSourceMap.set(bundleName, rendererSource)

		const isViteDev = bundler === 'vite' && isDevServer
		const emitRoot = outRoot || process.cwd()
		const emitSubdir = assetsSubdir || ''
		const wrapperLines: string[] = []

		for (const document of documents) {
			const init: {
				knownAssets: string[]
				assetUrls: Record<string, string> | null
				assetsPath: string | null
				assetsUrl: string | null
			} = { knownAssets: [], assetUrls: null, assetsPath: null, assetsUrl: null }

			if (assetMode === 'static') {
				let zipBuffer: Buffer | null = null

				try {
					zipBuffer = await readFile(document.assetsPath!)
				} catch {
					logger.debug(`No assets found for document: ${document.documentName}`)
				}

				if (zipBuffer) {
					init.knownAssets = listZipEntries(new Uint8Array(zipBuffer))

					if (isViteDev && target === 'node') {
						init.assetsUrl = pathToFileURL(document.assetsPath!).href
					} else if (isViteDev) {
						memoryAssets.set(`${document.documentName}.zip`, zipBuffer)
						init.assetsUrl = `/__format-assets/${document.documentName}.zip`
					} else {
						const emitted = await emitAssetFile({
							emitFile,
							buffer: zipBuffer,
							relName: `${document.documentName}/assets.zip`,
							outRoot: emitRoot,
							assetsSubdir: emitSubdir,
							emittedAssetNames,
							bundler
						})
						init.assetsPath = emitted.startsWith('./') ? emitted : `./${emitted}`
					}
				}
			} else if (assetMode === 'dynamic') {
				const compiledUrlMap = compiledBundle.assetState.get(document.documentName)?.urlMap ?? {}
				const entries = dynamicAssetEmitEntries({
					outDir: compiledBundle.outDir,
					documentName: document.documentName,
					urlMap: compiledUrlMap
				})

				const urlMap: Record<string, string> = {}

				for (const entry of entries) {
					if (isViteDev && target === 'node') {
						urlMap[entry.knownPath] = pathToFileURL(entry.sourcePath).href
						continue
					}

					if (isViteDev) {
						urlMap[entry.knownPath] = `/__format-assets/${entry.emitPath}`
						continue
					}

					const emitted = await emitAssetFile({
						emitFile,
						buffer: await readFile(entry.sourcePath),
						relName: entry.emitPath,
						outRoot: emitRoot,
						assetsSubdir: emitSubdir,
						emittedAssetNames,
						bundler
					})
					urlMap[entry.knownPath] = emitted.startsWith('./') ? emitted : `./${emitted}`
				}

				init.assetUrls = urlMap
				init.knownAssets = Object.keys(urlMap).sort()
			}

			wrapperLines.push(
				`const ${document.exportName} = createRendererWrapper(${JSON.stringify(document.documentName)}, resolveRenderer(${JSON.stringify(document.exportName)}), ${JSON.stringify(init)});`
			)
		}

		const exportList = documents.map(doc => doc.exportName).join(', ')
		const rendererPath = useZeroPrefix ? addZeroPrefix(rendererVirtualId) : rendererVirtualId
		const factory = buildWrapperFactorySource({
			mode: assetMode,
			target,
			zipModulePath: resolveZipModulePath(assetMode)
		})

		return [
			`import * as rendererModule from ${JSON.stringify(rendererPath)};`,
			factory,
			[
				`function resolveRenderer(name) {`,
				`	const renderer = rendererModule?.[name] ?? rendererModule?.default?.[name] ?? rendererModule?.default?.default?.[name];`,
				`	if (!renderer) {`,
				`		throw new Error('Renderer export "' + name + '" not found');`,
				`	}`,
				`	return renderer;`,
				`}`
			].join('\n'),
			wrapperLines.join('\n'),
			`export { ${exportList} };`,
			`export default { ${exportList} };`,
			''
		].join('\n\n')
	} catch (error) {
		logger.error('Virtual module build failure', {
			assetsSubdir,
			outRoot,
			bundler,
			virtualModuleName
		})

		logger.error(error)

		return null
	}
}

export const universalBundlerPlugin = createUnplugin<FormatUnpluginOptions>((options: FormatUnpluginOptions) => {
	setLogLevel(parseLogLevelFromEnv())

	logger.debug(`${PLUGIN_NAME} options`, options)

	const target: Target = options.target || DEFAULT_TARGET
	const userBundleName = resolveBundleName(options.bundleName)
	const userBundleNamePattern = escapeRegExp(userBundleName)

	let config: FormatConfig
	let outRoot: string | undefined
	let assetsSubdir: string | undefined
	let compiledDocuments: Map<string, CompiledDocument> = new Map()
	let emittedAssetNames: Set<string> = new Set()
	let useZeroPrefix = true
	let bundler: Bundler = 'rollup'
	let isDevServer = false
	let compiledBundle: CompiledBundle | null = null

	const rendererSourceMap = new Map<string, string>()

	function reset() {
		assetsSubdir = sanitiseSubdir(options.assetsOutDir)
		emittedAssetNames.clear()
	}

	return {
		name: PLUGIN_NAME,

		__virtualModulePrefix: VIRTUAL_MODULE_PREFIX,

		async buildStart() {
			logger.debug('Getting Format config')
			const result = await loadConfig(options.configPath)
			config = result.config
			await warnOnLockstepDrift(options.configPath ? dirname(options.configPath) : process.cwd())
			reset()
		},

		resolveId(id, importer) {
			const rendererImporter = importer ? stripPrefix(importer, RENDERER_MODULE) : null
			if (rendererImporter !== null && id.startsWith('.')) {
				if (!compiledBundle) {
					return null
				}
				return resolve(compiledBundle.outDir, id)
			}

			const virtualName = stripPrefix(id, VIRTUAL_MODULE_PREFIX)
			if (virtualName !== null) {
				if (virtualName !== userBundleName && virtualName !== `renderer/${userBundleName}`) {
					throw new Error(
						`Unknown Format virtual module "${virtualName}". Use "${VIRTUAL_MODULE_PREFIX}${userBundleName}".`
					)
				}

				const clean = cleanId(id)
				return useZeroPrefix ? addZeroPrefix(clean) : clean
			}

			return null
		},

		vite: {
			configResolved(viteConfig) {
				bundler = 'vite'
				useZeroPrefix = true
				isDevServer = viteConfig.command === 'serve'
				outRoot = resolve(viteConfig.root || process.cwd(), viteConfig.build.outDir)
				reset()
			},

			configureServer(server) {
				server.middlewares.use('/__format-assets', async (req, res, next) => {
					const urlPath = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0]!)

					const sendBuffer = (buffer: Buffer) => {
						res.statusCode = 200
						res.setHeader('Content-Type', urlPath.endsWith('.zip') ? 'application/zip' : 'application/octet-stream')
						res.setHeader('Cache-Control', 'no-store')
						res.end(buffer)
					}

					const memoryBuffer = memoryAssets.get(urlPath)

					if (memoryBuffer) {
						sendBuffer(memoryBuffer)
						return
					}

					// Dynamic-mode dev: mapped asset files are served straight from
					// the compiled outDir, mirroring its layout.
					if (!compiledBundle) {
						next()
						return
					}

					const outDirRoot = resolve(compiledBundle.outDir)
					const filePath = resolve(outDirRoot, urlPath)
					const escapesOutDir = filePath !== outDirRoot && !filePath.startsWith(outDirRoot + '/')

					if (escapesOutDir) {
						next()
						return
					}

					try {
						sendBuffer(await readFile(filePath))
					} catch {
						next()
					}
				})
			},

			async handleHotUpdate(ctx) {
				const file = ctx.file
				const root = ctx.server.config.root

				if (file.includes(`/${DEFAULT_OUT_DIR_NAME}/`)) {
					logger.debug(`[HMR] Ignored ${DEFAULT_OUT_DIR_NAME} output:`, file)
					return undefined
				}

				if (options.outDir && file.startsWith(resolve(root, options.outDir))) {
					logger.debug('[HMR] Ignored outDir output:', file)
					return undefined
				}

				// Does this update belong to a format document?
				for (const [documentName] of compiledDocuments) {
					const indexPath = await getUserDocumentIndex({ documentName, config })
					const documentDir = dirname(indexPath)

					if (file.startsWith(documentDir)) {
						logger.debug(`[HMR] File affects document "${documentName}"`)

						compiledDocuments.clear()
						rendererSourceMap.clear()
						compiledBundle = null

						logger.debug('[HMR] Recompiling Format bundle')
						compiledBundle = await compileBundle({
							config,
							options,
							compiledDocuments,
							compiledBundle,
							bundler
						})

						// Invalidate the user's virtual module import tree
						const mainId = useZeroPrefix
							? addZeroPrefix(`${VIRTUAL_MODULE_PREFIX}${userBundleName}`)
							: `${VIRTUAL_MODULE_PREFIX}${userBundleName}`
						const mainModule = ctx.server.moduleGraph.getModuleById(mainId)

						if (mainModule) {
							logger.debug(`[HMR] Invalidating Vite module: ${mainId}`)
							ctx.server.moduleGraph.invalidateModule(mainModule)
						} else {
							logger.debug(`[HMR] Main module not in graph yet: ${mainId}`)
						}

						// Invalidate the renderer virtual module import tree
						const rendererVirtualId = `${RENDERER_MODULE}${userBundleName}`
						const rendererId = useZeroPrefix ? addZeroPrefix(rendererVirtualId) : rendererVirtualId
						const rendererModule = ctx.server.moduleGraph.getModuleById(rendererId)

						if (rendererModule) {
							logger.debug(`[HMR] Invalidating renderer module: ${rendererId}`)
							ctx.server.moduleGraph.invalidateModule(rendererModule)
						} else {
							logger.debug(`[HMR] Renderer module not in graph yet: ${rendererId}`)
						}

						// Trigger HMR for both (main + renderer)
						const modules = [mainModule, rendererModule].filter((m): m is NonNullable<typeof m> => m !== undefined)
						return modules.length > 0 ? modules : undefined
					}
				}

				// Not related to any document → normal Vite handling
				return undefined
			}
		},

		rollup: {
			outputOptions(rollupOut) {
				bundler = 'rollup'
				useZeroPrefix = true
				outRoot = rollupOut.dir ?? (rollupOut.file ? dirname(rollupOut.file) : process.cwd())
				reset()
				return rollupOut
			}
		},

		webpack(compiler) {
			bundler = 'webpack'
			useZeroPrefix = true
			outRoot = compiler.options.output?.path ?? process.cwd()

			// Keep `import.meta.url` native inside Format's virtual modules so the
			// emitted `assets.zip` URL resolves against the bundle's runtime
			// location. Webpack otherwise rewrites a bare `import.meta.url` to a
			// build-time `file:` URL, and turns `new URL(dynamicPath,
			// import.meta.url)` into an empty context module that throws at
			// runtime. `url: false` disables the latter; `importMeta: false` keeps
			// the former native. The rule is scoped to the encoded virtual-module
			// resource (`\0@format:` arrives as `%00%40format%3A`) so the
			// consumer's own `import.meta` and `new URL` usage is left alone.
			const formatVirtualModule = /(?:@|%40)format(?::|%3a)/i

			// webpack always provides normalized `module.rules`; guard only the array.
			compiler.options.module.rules ??= []
			compiler.options.module.rules.push({
				test: formatVirtualModule,
				parser: { url: false, importMeta: false }
			})

			reset()
		},

		esbuild: {
			setup(build) {
				bundler = 'esbuild'
				useZeroPrefix = false
				outRoot =
					build.initialOptions.outdir ??
					(build.initialOptions.outfile ? dirname(build.initialOptions.outfile) : process.cwd())
				reset()

				const namespace = PLUGIN_NAME
				const VIRTUAL_RE = new RegExp(`^format:(?:renderer\\/)?${userBundleNamePattern}$`)

				build.onResolve({ filter: VIRTUAL_RE }, args => {
					return { path: args.path, namespace }
				})

				build.onLoad({ filter: /.*/, namespace }, async args => {
					const id = cleanId(args.path)

					// Serve renderer source
					const rendererName = stripPrefix(id, RENDERER_MODULE)
					if (rendererName !== null) {
						const source = getRegisteredRendererSource(rendererName, rendererSourceMap)
						return {
							contents: source,
							loader: 'js',
							resolveDir: compiledBundle?.outDir ?? process.cwd()
						}
					}

					// Serve main virtual doc module
					const virtualModuleName = stripPrefix(id, VIRTUAL_MODULE_PREFIX)
					if (virtualModuleName === null) {
						return null
					}

					if (virtualModuleName !== userBundleName) {
						throw new Error(
							`Unknown Format virtual module "${virtualModuleName}". Use "${VIRTUAL_MODULE_PREFIX}${userBundleName}".`
						)
					}

					logger.debug(`Format virtual module loaded: ${id}`)

					compiledBundle = await compileBundle({
						config,
						options,
						compiledDocuments,
						compiledBundle,
						bundler
					})

					const code = await buildVirtualModuleCode({
						target,
						useZeroPrefix,
						options,
						config,
						compiledDocuments,
						compiledBundle,
						rendererSourceMap,
						outRoot,
						assetsSubdir,
						emittedAssetNames,
						bundler,
						emitFile: () => {},
						virtualModuleName,
						isDevServer: false,
						bundleName: userBundleName
					})

					if (code === null) {
						return null
					}

					return {
						contents: code,
						loader: 'js',
						resolveDir: process.cwd()
					}
				})
			}
		},

		transformInclude(id) {
			const cid = cleanId(id)
			return /\.(m?[jt]sx?|cjs|mts|cts|vue|svelte)$/.test(cid)
		},

		transform(code) {
			if (!useZeroPrefix) {
				return null
			}

			const rewritten = code.replace(/(import\s+[^'"]*from\s*|import\s*\(\s*|require\s*\(\s*)['"]format:/g, $0 =>
				$0.replace('format:', '\0format:')
			)

			return rewritten === code ? null : { code: rewritten, map: null }
		},

		async load(id: string) {
			// Serve the renderer source for our virtual renderer module
			const rendererName = stripPrefix(id, RENDERER_MODULE)

			if (rendererName !== null) {
				return getRegisteredRendererSource(rendererName, rendererSourceMap)
			}

			// Serve the main virtual doc module
			const virtualModuleName = stripPrefix(id, VIRTUAL_MODULE_PREFIX)

			if (virtualModuleName === null) {
				return null
			}

			if (virtualModuleName !== userBundleName) {
				throw new Error(
					`Unknown Format virtual module "${virtualModuleName}". Use "${VIRTUAL_MODULE_PREFIX}${userBundleName}".`
				)
			}

			logger.debug(`Format virtual module loaded: ${id}`)

			const emitFile = this.emitFile ? this.emitFile.bind(this) : () => {}

			compiledBundle = await compileBundle({
				config,
				options,
				compiledDocuments,
				compiledBundle,
				bundler
			})

			return buildVirtualModuleCode({
				target,
				useZeroPrefix,
				options,
				config,
				compiledDocuments,
				compiledBundle,
				rendererSourceMap,
				outRoot,
				assetsSubdir,
				emittedAssetNames,
				bundler,
				emitFile,
				virtualModuleName,
				isDevServer,
				bundleName: userBundleName
			})
		}
	}
})

export const formatVitePlugin = universalBundlerPlugin.vite
export const formatRollupPlugin = universalBundlerPlugin.rollup
export const formatRolldownPlugin = universalBundlerPlugin.rollup
export const formatWebpackPlugin = universalBundlerPlugin.webpack
export const formatEsbuildPlugin = universalBundlerPlugin.esbuild
