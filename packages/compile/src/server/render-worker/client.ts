/**
 * Main-process client for the render worker subprocess.
 *
 * Manages worker lifecycle (spawn, restart, dispose) and provides
 * typed methods for compile-path and dev-server-path rendering.
 *
 * For dev-server rendering, the subprocess runs its own headless Vite
 * server with the same plugin configuration. All module resolution,
 * transforms, and evaluation happen in the subprocess — the main
 * process just sends render requests and receives final HTML.
 */

import type {
	WorkerRequest,
	WorkerResponse,
	RenderResult,
	CompileRenderRequest,
	DevRenderRequest,
	DevInitRequest
} from './types'

import { fork, type ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { buildSafeEnv } from './env'
import { deserializeError } from './error'
import { SANDBOX_ERROR_CODE } from './sandbox'
import { _dirname } from '../project/paths'

/**
 * Resolve the path to the compiled worker host entry point. The dist is
 * unbundled, so host.js sits next to this module at dist/server/render-worker/.
 * In dev/test _dirname points to src/, so fall back to the built dist.
 */
function getWorkerHostPath(): string {
	const fromDist = resolve(_dirname, 'server', 'render-worker', 'host.mjs')
	if (existsSync(fromDist)) return fromDist
	return resolve(_dirname, '..', 'dist', 'server', 'render-worker', 'host.mjs')
}

/**
 * Compute the minimal set of filesystem paths the render worker needs
 * read access to. Used with Node's --experimental-permission model to
 * prevent user template code from reading sensitive files (.env, ~/.ssh, etc.).
 *
 * The worker needs:
 *   1. Its own dist directory (compiled worker host + chunks)
 *   2. node_modules directories (for externalized deps like vite, react, vue)
 *   3. The Node.js installation directory (for native addons, if any)
 *   4. Any extra paths provided by the caller (e.g. project source dirs)
 */
function computeAllowedReadPaths(extraPaths?: string[]): string[] {
	const paths = new Set<string>()

	/**
	 * Add a directory to the allowed set. Uses realpathSync so symlinked
	 * directories (e.g. /tmp → /private/tmp on macOS) match what the
	 * permission model actually checks.
	 *
	 * The `/*` suffix is required — Node 22's permission model treats
	 * bare paths as exact-file matches. `dir/*` grants recursive read
	 * access to all files under `dir` (including `stat(dir)` itself).
	 */
	const addDir = (dir: string) => {
		let resolved: string

		try {
			resolved = realpathSync(resolve(dir))
		} catch {
			resolved = resolve(dir)
		}

		if (resolved.endsWith('/')) {
			resolved = resolved.slice(0, -1)
		}

		paths.add(resolved + '/*')
	}

	// Worker's own code directory (dist/node/)
	addDir(dirname(getWorkerHostPath()))

	/**
	 * Walk up from a directory, adding every node_modules found.
	 * Also resolves symlinks inside each node_modules — pnpm workspace
	 * packages are symlinked to their real source directories, and Node's
	 * permission model checks the real path, not the symlink.
	 *
	 * Intermediate directories between consecutive node_modules are also
	 * added because Node's module resolver does stat() on
	 * `<dir>/node_modules` at every level. Without read permission on
	 * these gaps, the Permission Model throws ERR_ACCESS_DENIED (instead
	 * of ENOENT), which breaks module resolution entirely.
	 */
	const findNodeModules = (startDir: string) => {
		let dir = resolve(startDir)
		const gapDirs: string[] = []

		while (true) {
			const nm = resolve(dir, 'node_modules')

			if (existsSync(nm)) {
				addDir(nm)
				resolveSymlinkedPackages(nm)

				for (const gap of gapDirs) {
					addDir(gap)
				}
				gapDirs.length = 0
			} else {
				gapDirs.push(dir)
			}

			const parent = dirname(dir)
			if (parent === dir) break
			dir = parent
		}
	}

	/** Resolve symlinks in a node_modules directory (top-level + scoped). */
	const resolveSymlinkedPackages = (nmDir: string) => {
		let entries: string[]

		try {
			entries = readdirSync(nmDir)
		} catch {
			return
		}

		for (const entry of entries) {
			const entryPath = resolve(nmDir, entry)

			if (entry.startsWith('@')) {
				resolveSymlinkedPackages(entryPath)
				continue
			}

			try {
				const realPath = realpathSync(entryPath)
				if (realPath !== entryPath) {
					addDir(realPath)
				}
			} catch {
				// Broken symlink or inaccessible — skip
			}
		}
	}

	// Find node_modules from the worker's dist dir and the project cwd.
	// Covers pnpm workspace hoisting where deps live at the monorepo root.
	findNodeModules(dirname(getWorkerHostPath()))
	findNodeModules(process.cwd())

	// For extra paths (e.g. project source dirs, compile output dirs):
	// walk up to the workspace root, adding each directory and any
	// node_modules found along the way. Vite's searchForWorkspaceRoot
	// calls existsSync() in every ancestor looking for markers like
	// .git and pnpm-workspace.yaml. Without read permission on these
	// directories the Permission Model throws ERR_ACCESS_DENIED
	// (instead of ENOENT), which crashes Vite during init.
	//
	// We stop at the workspace root (.git or pnpm-workspace.yaml) so
	// ancestor directories above the project (e.g. ~/.ssh, ~/.aws)
	// remain inaccessible.
	if (extraPaths) {
		for (const p of extraPaths) {
			let dir = resolve(p)
			while (true) {
				addDir(dir)

				const nm = resolve(dir, 'node_modules')
				if (existsSync(nm)) {
					addDir(nm)
					resolveSymlinkedPackages(nm)
				}

				const isWorkspaceRoot = existsSync(resolve(dir, '.git')) || existsSync(resolve(dir, 'pnpm-workspace.yaml'))

				if (isWorkspaceRoot) break

				const parent = dirname(dir)
				if (parent === dir) break
				dir = parent
			}
		}
	}

	// Node.js installation — needed for native addons and internal resolution
	addDir(dirname(process.execPath))

	return [...paths]
}

interface PendingRequest {
	resolve: (result: RenderResult) => void
	reject: (error: Error) => void
	timer: ReturnType<typeof setTimeout>
}

export interface RenderWorkerOptions {
	timeout?: number
	/** Custom log function — defaults to console.debug */
	log?: (msg: string) => void
	/** Custom warn function — defaults to console.warn */
	warn?: (msg: string) => void
	/**
	 * Extra filesystem paths the worker is allowed to read.
	 * The worker always has read access to its own dist directory and
	 * node_modules. Use this for additional paths like project source dirs.
	 */
	allowedReadPaths?: string[]
	/**
	 * Sandbox mode for the worker subprocess.
	 *
	 * - 'strict': Node's --experimental-permission model with filesystem scoping.
	 *   No native addons, worker threads, or child processes. Used by compile
	 *   where the subprocess just does import() on a pre-built bundle.
	 *
	 * - 'standard': JS-level API patches that block network (fetch, http, net),
	 *   child_process, and other exfiltration vectors. Used by the dev path
	 *   where Vite's toolchain needs unrestricted filesystem access.
	 *
	 * - false: no sandbox. Worker still runs with a scrubbed environment.
	 *
	 * Both modes run with a scrubbed environment (env.ts allowlist).
	 */
	sandbox?: 'strict' | 'standard' | false
}

export class RenderWorker {
	private worker: ChildProcess | null = null
	private pending = new Map<string, PendingRequest>()
	private readyPromise: Promise<void> | null = null
	private timeout: number
	private log: (msg: string) => void
	private _warn: (msg: string) => void
	private allowedReadPaths?: string[]
	private sandbox: 'strict' | 'standard' | false
	// Replayed by restart() so a fresh subprocess re-initializes its headless
	// Vite server the same way the original dev-init call did.
	private lastInitArgs: Omit<DevInitRequest, 'id' | 'type'> | null = null
	// True while the current subprocess has a dev-init'd headless Vite server.
	// Cleared on dispose and on unexpected worker exit, so ensureDevInit()
	// knows a freshly spawned subprocess still needs its init replayed.
	private devInitialized = false
	// In-flight dev-init, shared so concurrent renders await one init
	// instead of each sending their own.
	private devInitPromise: Promise<void> | null = null
	// Held for the duration of a restart (dispose + dev-init). Renders await it so
	// one can't land in the gap after dispose() and spawn a fresh, un-init'd worker.
	private restartPromise: Promise<void> | null = null

	constructor(options?: RenderWorkerOptions) {
		this.timeout = options?.timeout ?? 30_000
		this.log = options?.log ?? ((msg: string) => console.debug(msg))
		this._warn = options?.warn ?? ((msg: string) => console.warn(msg))
		this.allowedReadPaths = options?.allowedReadPaths
		this.sandbox = options?.sandbox ?? false
	}

	private spawn(): ChildProcess {
		const hostPath = getWorkerHostPath()
		const env = buildSafeEnv()

		let execArgv: string[] = []

		if (this.sandbox === 'strict') {
			const allowedReadPaths = computeAllowedReadPaths(this.allowedReadPaths)

			let realTmpDir: string
			try {
				realTmpDir = realpathSync(tmpdir())
			} catch {
				realTmpDir = tmpdir()
			}
			const allowedWritePaths = [realTmpDir + '/*']

			execArgv = [
				'--no-warnings',
				'--experimental-permission',
				...allowedReadPaths.map(p => `--allow-fs-read=${p}`),
				...allowedWritePaths.map(p => `--allow-fs-write=${p}`)
			]

			this.log(`Spawning sandboxed render worker (strict): ${hostPath}`)
		} else if (this.sandbox === 'standard') {
			this.log(`Spawning sandboxed render worker (standard): ${hostPath}`)
		} else {
			this.log(`Spawning render worker: ${hostPath}`)
		}

		if (this.sandbox) {
			env.FMT_SANDBOX_MODE = this.sandbox
		}

		const child = fork(hostPath, [], {
			env,
			stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
			serialization: 'advanced',
			execArgv
		})

		// Forward worker stdout/stderr through the logger
		child.stdout?.on('data', (data: Buffer) => {
			const text = data.toString().trim()

			if (text) {
				this.log(`[render-worker] ${text}`)
			}
		})

		child.stderr?.on('data', (data: Buffer) => {
			const text = data.toString().trim()

			if (!text) {
				return
			}

			if (text.includes(SANDBOX_ERROR_CODE)) {
				return
			}

			this._warn(`[render-worker] ${text}`)
		})

		child.on('message', (msg: any) => {
			const response = msg as WorkerResponse

			if (response.type === 'ready') {
				return
			}

			// Route dev-init-result to pending callbacks (same as render results)
			if (response.type === 'dev-init-result') {
				const pending = this.pending.get(response.id)

				if (!pending) {
					return
				}

				this.pending.delete(response.id)
				clearTimeout(pending.timer)
				pending.resolve(response as any)
				return
			}

			const pending = this.pending.get(response.id)

			if (!pending) {
				return
			}

			this.pending.delete(response.id)
			clearTimeout(pending.timer)

			if (response.type === 'render-result') {
				pending.resolve(response)
			} else if (response.type === 'render-error') {
				pending.reject(deserializeError(response.error))
			}
		})

		child.on('exit', (code, signal) => {
			this.log(`Render worker exited (code=${code}, signal=${signal})`)

			// A killed worker's 'exit' event fires asynchronously, sometimes after
			// restart() has already spawned and initialized its replacement. Only
			// clear state if this child is still the active worker — otherwise a
			// stale exit event wipes out a perfectly healthy newer one, leaving
			// `this.worker` null until the next request spawns an uninitialized
			// worker that was never sent dev-init.
			if (this.worker !== child) {
				return
			}

			this.worker = null
			this.devInitialized = false

			// Reject all pending requests
			for (const [, pending] of this.pending) {
				clearTimeout(pending.timer)
				pending.reject(new Error(`Render worker exited unexpectedly (code=${code})`))
			}
			this.pending.clear()
		})

		this.worker = child
		return child
	}

	private async ensureWorker(): Promise<ChildProcess> {
		if (this.worker && !this.worker.killed) {
			return this.worker
		}

		const child = this.spawn()

		this.readyPromise = new Promise<void>((resolve, reject) => {
			const onReady = (msg: any) => {
				if (msg?.type === 'ready') {
					child.off('message', onReady)
					child.off('error', onError)
					resolve()
				}
			}
			const onError = (err: Error) => {
				child.off('message', onReady)
				reject(err)
			}
			child.on('message', onReady)
			child.once('error', onError)
		})

		await this.readyPromise
		return child
	}

	private async send<T extends WorkerRequest>(request: T): Promise<RenderResult> {
		const child = await this.ensureWorker()
		const id = request.id || randomUUID()
		const msg = { ...request, id }

		return new Promise<RenderResult>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id)
				reject(new Error(`Render worker timed out after ${this.timeout}ms`))
			}, this.timeout)

			this.pending.set(id, { resolve, reject, timer })
			child.send(msg)
		})
	}

	/**
	 * Initialize the subprocess's headless Vite dev server.
	 * Must be called once before any devRender() calls.
	 */
	async initDev(args: Omit<DevInitRequest, 'id' | 'type'>): Promise<void> {
		this.lastInitArgs = args

		const init = this.send({
			id: randomUUID(),
			type: 'dev-init',
			...args
		} as DevInitRequest).then(() => {
			this.devInitialized = true
		})

		this.devInitPromise = init

		try {
			await init
		} finally {
			if (this.devInitPromise === init) {
				this.devInitPromise = null
			}
		}
	}

	/**
	 * Guarantee the current subprocess has been dev-init'd before a dev render
	 * is sent. Without this, a worker spawned in the gap after dispose() (or
	 * after a crash) starts with no headless Vite server, and every dev render
	 * against it fails until something replays the init.
	 */
	private async ensureDevInit(): Promise<void> {
		if (this.devInitPromise) {
			await this.devInitPromise
		}

		const workerAlive = this.worker !== null && !this.worker.killed

		if (workerAlive && this.devInitialized) {
			return
		}

		if (!this.lastInitArgs) {
			throw new Error('Render worker is not initialized for dev rendering. Call initDev() before devRender().')
		}

		await this.initDev(this.lastInitArgs)
	}

	// Refresh the config that restart() replays, so a restart after a config change
	// (e.g. enabling Panda) re-initialises the worker with the new config rather than
	// the one captured at first init.
	updateInitConfig(configJson: string): void {
		if (this.lastInitArgs) {
			this.lastInitArgs = { ...this.lastInitArgs, configJson }
		}
	}

	/**
	 * Kill and respawn the subprocess, replaying the last dev-init call.
	 *
	 * The subprocess's headless Vite server is created once and reused for
	 * every render, with dependency discovery disabled (optimizeDeps.noDiscovery)
	 * for determinism. That means a package installed mid-session — e.g. by the
	 * "new document" flow's install-dependencies step — is invisible to its
	 * resolver until the process (and its Vite instance) starts fresh. Call this
	 * after any change to node_modules the next render depends on.
	 */
	async restart(): Promise<void> {
		const doRestart = async () => {
			if (!this.lastInitArgs) {
				await this.dispose()
				return
			}

			const initArgs = this.lastInitArgs
			await this.dispose()
			await this.initDev(initArgs)
		}

		// Publish the in-flight restart so renders wait for re-init instead of
		// spawning a worker into the disposed gap. initDev's own send bypasses this
		// (it's part of the restart), so there's no deadlock.
		this.restartPromise = doRestart()

		try {
			await this.restartPromise
		} finally {
			this.restartPromise = null
		}
	}

	async devRender(args: Omit<DevRenderRequest, 'id' | 'type'>): Promise<{ html: string }> {
		if (this.restartPromise) {
			await this.restartPromise
		}

		await this.ensureDevInit()

		const result = await this.send({
			id: randomUUID(),
			type: 'dev-render',
			...args
		})
		return { html: result.html }
	}

	async compileRender(args: Omit<CompileRenderRequest, 'id' | 'type'>): Promise<string> {
		if (this.restartPromise) {
			await this.restartPromise
		}

		const result = await this.send({
			id: randomUUID(),
			type: 'compile-render',
			...args
		})
		return result.html
	}

	async dispose(): Promise<void> {
		if (this.worker) {
			this.worker.kill()
			this.worker = null
		}

		this.devInitialized = false

		for (const [, pending] of this.pending) {
			clearTimeout(pending.timer)
			pending.reject(new Error('Render worker disposed'))
		}
		this.pending.clear()
	}
}
