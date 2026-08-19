/**
 * Options for the runtime zip build (dynamic asset mode). The single source of
 * truth for the option shape, shared by the renderer's `setZipOptions` and
 * `@format.dev/zip`'s `zip()`, which re-exports this type as `ZipOptions`.
 */
export interface ZipOptions {
	/** Log and skip missing assets instead of rejecting on the first one. */
	skipMissing?: boolean

	/** Deflate options. Only `level` (0–9) is read. */
	zlib?: { level?: number }

	/**
	 * Fetch remote references when calling `zip()`. By default, remote assets are not fetched.
	 * Unless enabled, a remote asset path found at `zip()` will throw `RemoteAssetsDisabledError`.
	 *
	 * Generally not recommended on a production render path — fetching
	 * per render reintroduces the network as a failure mode and repeats on
	 * every render. Prefer local files.
	 *
	 * @summary Control whether `zip()` fetches remote asset references in your HTML.
	 */
	remoteAssets?: {
		enabled?: boolean
		headers?: Headers | Record<string, string> | [string, string][]
		timeoutMs?: number
	}
}

/**
 * Asset configuration for a renderer. These settings are renderer-scoped: they
 * apply to every document the renderer produces. Set them once before rendering
 * rather than on a render result.
 */
export interface FormatAssetConfig {
	/**
	 * Returns the URL the renderer will use to locate the assets ZIP.
	 * On the `node` target this is auto-initialized to the local `assets.zip`.
	 * On `browser` and `worker` targets it returns `undefined` until `setAssetsUrl` is called.
	 *
	 * @summary Returns the URL the renderer will use to locate the assets ZIP.
	 */
	getAssetsUrl(): string | undefined

	/**
	 * Sets the assets URL at runtime. Call this before `render()` when your assets ZIP is
	 * hosted on a CDN or object storage bucket.
	 *
	 * @summary Sets the assets URL at runtime.
	 */
	setAssetsUrl(url: string): void

	/**
	 * Sets options for a runtime ZIP build (dynamic asset mode). Call this
	 * before `render()`, e.g. to enable `remoteAssets` for documents that
	 * reference remote URLs. Has no effect if your ZIP was built at compile.
	 *
	 * @summary set `ZipOptions` at runtime.
	 */
	setZipOptions?(options: ZipOptions | undefined): void
}

/**
 * The result of calling `renderer.render()`. Pass this directly to `FormatClient.pdf()`.
 */
export interface FormatDocument {
	/** The rendered Format-compatible template string. */
	html: string

	/**
	 * Returns a web stream to the assets ZIP.
	 *
	 * If the assets ZIP was built at compile, bytes will be loaded from the filesystem.
	 * If using a runtime outside of Node, bytes will be loaded via `fetch` using the URL
	 * set with `setAssetsUrl()`. Otherwise, returns undefined.
	 *
	 * @summary Get a web stream of the assets `ZIP` attached to the renderer.
	 */
	getAssetsWebStream(): Promise<ReadableStream<Uint8Array> | undefined>
}

/**
 * A compiled Format document renderer. Configure assets once, then call
 * `render()` with your data to produce a `FormatDocument` that can be passed
 * directly to `FormatClient.pdf()`.
 */
export interface FormatRenderer extends FormatAssetConfig {
	/**
	 * Renders the document with the provided data and returns a `FormatDocument`.
	 *
	 * @param data - A JavaScript object passed to your document template with any arbitrary data.
	 */
	render(data?: Record<string, unknown>): Promise<FormatDocument>

	/**
	 * Returns a web stream to the assets ZIP.
	 *
	 * If the assets ZIP was built at compile, bytes will be loaded from the filesystem.
	 * If using a runtime outside of Node, bytes will be loaded via `fetch` using the URL
	 * set with `setAssetsUrl()`. Otherwise, returns undefined.
	 *
	 * @summary Get a web stream of the assets `ZIP` attached to the renderer.
	 */
	getAssetsWebStream(): Promise<ReadableStream<Uint8Array> | undefined>
}
