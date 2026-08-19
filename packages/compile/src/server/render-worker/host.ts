/**
 * Render worker host — runs in a forked child process.
 *
 * Handles two execution paths:
 *   1. compile-render: imports a pre-built bundle, calls its render()
 *   2. dev-render: runs a headless Vite dev server with ssrLoadModule()
 *      so all plugins (Vue SFC, Linaria, Vanilla Extract, etc.) work
 *      with transforms and evaluation in the same process
 *
 * This process runs with a scrubbed environment (see env.ts), so user
 * code cannot access the parent process's secrets.
 */

import type { WorkerRequest, WorkerResponse, CompileRenderRequest, DevRenderRequest, DevInitRequest } from './types'
import type { ViteDevServer, ModuleNode } from 'vite'

import { serializeError } from './error'
import { pathToFileURL } from 'node:url'
import { getDocumentExportName } from '@format.dev/cli/scaffold'
import { formatForLog } from '../utils/format-for-log'
import { finalizeDocumentHtml } from '../compile/finalize-document-html'
import { applySandboxPatches } from './sandbox'

// Apply JS-level API patches (network, child_process) before any user code
// runs. In 'strict' mode, Node's --experimental-permission handles this
// at the runtime level instead.
if (process.env.FMT_SANDBOX_MODE === 'standard') {
	applySandboxPatches()
}

async function handleCompileRender(request: CompileRenderRequest): Promise<string> {
	const { bundlePath, documentName, data, cwd } = request

	// Dynamic import with cache buster — same strategy as get-renderer.ts
	const url = new URL(pathToFileURL(bundlePath).href)
	url.search = `?t=${Date.now()}-${Math.random().toString(36).slice(2)}`

	const bundle = await import(url.href)

	// Resolve the named export (same logic as resolveRenderer in get-renderer.ts)
	const exportName = getDocumentExportName(documentName)

	const renderer = bundle?.[exportName] ?? bundle?.default?.[exportName] ?? bundle?.default?.default?.[exportName]

	if (!renderer) {
		throw new Error(`Renderer export "${exportName}" not found for document "${documentName}"`)
	}

	const result = await renderer.render(data || {}, cwd)

	// The CLI-compiled wrapper returns a FormatDocument object while the inner renderer
	// returns a plain string. Extract FormatDocument.html for IPC serialization.
	return typeof result === 'object' && result !== null && 'html' in result ? result.html : result
}

let devServer: ViteDevServer | null = null
let devDecodeStyleEntities = false

async function handleDevInit(request: DevInitRequest): Promise<void> {
	const { root, configJson, decodeStyleEntities: decode } = request

	devDecodeStyleEntities = decode === true

	// Hydrate runtime state so createConfig() and adaptors work
	const { setUserProjectDir } = await import('../project/user-project-dir')
	setUserProjectDir(root)

	const { compileState } = await import('../runtime-state')
	compileState.setConfig(JSON.parse(configJson))

	// Build Vite config using the same factory as the main server
	const { createConfig } = await import('../vite/create-config')
	const { collectCssPlugin } = await import('../vite/plugins/collect-css')
	const { stylesPreProcessor } = await import('../vite/plugins/styles-pre-processor')

	const { baseViteConfig, frameworkPlugins, stylePlugins } = createConfig()

	const { createServer, mergeConfig } = await import('vite')

	const { join } = await import('node:path')
	const { tmpdir } = await import('node:os')

	const workerLogger = {
		info: (msg: string) => console.log(msg),
		warn: (msg: string) => console.warn(msg),
		error: () => {},
		warnOnce: (msg: string) => console.warn(msg),
		hasWarned: false,
		clearScreen: () => {},
		hasErrorLogged: () => false
	}

	const serverConfig = mergeConfig(baseViteConfig, {
		configFile: false,
		clearScreen: false,
		envFile: false, // Block .env file loading — primary .env protection
		cacheDir: join(tmpdir(), 'format-vite-cache'),
		logLevel: 'info',
		customLogger: workerLogger,
		server: {
			middlewareMode: true,
			watch: null // No file watching — main server handles HMR
		},
		plugins: [await stylesPreProcessor(false), ...frameworkPlugins, ...stylePlugins, collectCssPlugin()],
		resolve: {
			// Force framework packages to resolve from the user's project
			// (Vite root) rather than from workspace packages like
			// @format.dev/react or @format.dev/vue, which may resolve to a different
			// version at the workspace root.
			dedupe: ['react', 'react-dom', 'vue', 'vue/server-renderer']
		},
		ssr: {
			// We externalize third-party node_modules to Node's own loader,
			// which is the only path that handles CommonJS packages. Inlining
			// CJS into Vite's ESM module runner throws "module is not defined"
			// (its entry has no `module` global), so a document importing any
			// CJS-only library — highlight.js, and thousands like it — would
			// otherwise crash the render.
			//
			// noExternal as an array keeps Vite's default of auto-bundling
			// linked workspace packages and adds @format.dev/* on top, so our SDK
			// is always bundled (even when installed from npm, not symlinked).
			// Bundling routes its react/vue imports through resolve.dedupe
			// below, giving the user's single framework instance and avoiding
			// the dual-instance crashes that a blanket noExternal was added for.
			//
			// react/react-dom and vue/vue-server-renderer stay external
			// because their entry files are CJS (module.exports) which fails
			// in Vite's ESM evaluator. The adaptors manually load them from
			// the user's project via createRequire.
			noExternal: [/@format(?:\.dev)?\//],
			external: ['react', 'react-dom', 'vue', 'vue/server-renderer']
		},
		optimizeDeps: {
			noDiscovery: true,
			entries: false
		}
	})

	devServer = await createServer(serverConfig)
}

function invalidateTree(server: ViteDevServer, id: string) {
	const seen = new Set<ModuleNode>()
	const mod = server.moduleGraph.getModuleById(id)

	if (!mod) {
		return
	}

	const stack = [mod]

	while (stack.length) {
		const cur = stack.pop()!

		if (seen.has(cur)) {
			continue
		}

		seen.add(cur)
		server.moduleGraph.invalidateModule(cur)
		cur.importedModules.forEach(m => stack.push(m))
	}
}

const frameworkAdaptors: Record<string, () => Promise<any>> = {
	react: () => import('../compile/adaptors/react-node'),
	vue: () => import('../compile/adaptors/vue-node'),
	html: () => import('../compile/adaptors/html')
}

async function handleDevRender(request: DevRenderRequest): Promise<{ html: string }> {
	if (!devServer) {
		throw new Error('Dev server not initialized. Send a dev-init message first.')
	}

	const { entryFilePath, data, framework, engineVersion } = request
	const { compileState } = await import('../runtime-state')
	const { decodeStyleEntities } = await import('../compile/decode-style-entities')

	console.log(`Render started (framework=${framework}, engine=${engineVersion})`)

	// Resolve symlinks so the path matches Vite's module graph IDs
	// (Vite stores modules by their real path, not the symlink path)
	const { realpathSync } = await import('node:fs')
	let resolvedEntryPath = entryFilePath

	try {
		resolvedEntryPath = realpathSync(entryFilePath)
	} catch {
		// File might not exist yet during initial load
	}

	// Clear collected CSS and invalidate the module tree so transforms
	// re-run and collectCssPlugin re-collects all styles.
	const css = compileState.getCss()
	css.clear()
	invalidateTree(devServer, resolvedEntryPath)

	const userModule: any = await devServer.ssrLoadModule(entryFilePath)

	if (!userModule?.default) {
		throw new Error(`Entry module does not export a default export: ${entryFilePath}`)
	}

	const Component = userModule.default
	const mod = await frameworkAdaptors[framework]()
	const adaptor = mod.default
	const { create, render } = adaptor

	// Resolve react/react-dom (and vue) from the user's project — the same
	// root Vite uses to resolve the document's jsx-runtime. Without this the
	// adaptor falls back to process.cwd(), which can resolve a different
	// framework copy: the document's elements would be created by one React
	// and rendered by another ("Objects are not valid as a React child").
	const { getUserProjectDir } = await import('../project/user-project-dir')
	const cwd = getUserProjectDir()

	const element = await create({ Component, data, cwd })
	const rawHtml = await render({ element: element as any, engine: engineVersion, cwd })

	// Stamp the engine version and inject the collected CSS as a document-level
	// <style>, in one parse. Empty payloads emit no tag (see finalize-document-html).
	let combinedStyles = ''

	for (const [, _css] of css) {
		combinedStyles += _css
	}

	let finalHtml = finalizeDocumentHtml({ html: rawHtml, engine: engineVersion, css: combinedStyles })

	if (devDecodeStyleEntities) {
		finalHtml = decodeStyleEntities(finalHtml)
	}

	const isDebug = process.env.FORMAT_DEBUG === '1' || process.env.FORMAT_DEBUG === 'true'

	if (isDebug) {
		const stylesLog = await formatForLog(combinedStyles, 'css')
		const htmlLog = await formatForLog(finalHtml, 'html')

		console.log('Final styles\n', `<style>\n${stylesLog}</style>`)
		// This is the raw render output; the dev-server middleware sanitizes it afterwards
		// and logs the post-sanitize result as "Final HTML (post-sanitize)".
		console.log('Rendered HTML (pre-sanitize)\n', htmlLog)
	}

	return { html: finalHtml }
}

function reply(msg: WorkerResponse) {
	process.send!(msg)
}

process.on('message', async (msg: any) => {
	const request = msg as WorkerRequest
	try {
		switch (request.type) {
			case 'compile-render': {
				const html = await handleCompileRender(request)
				reply({ id: request.id, type: 'render-result', html })
				break
			}

			case 'dev-init': {
				await handleDevInit(request)
				reply({ id: request.id, type: 'dev-init-result' })
				break
			}

			case 'dev-render': {
				const result = await handleDevRender(request)
				reply({ id: request.id, type: 'render-result', html: result.html })
				break
			}
		}
	} catch (error) {
		reply({
			id: request.id,
			type: 'render-error',
			error: serializeError(error)
		})
	}
})

// Signal readiness to the parent process
reply({ type: 'ready' } as WorkerResponse)
