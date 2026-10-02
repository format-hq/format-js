/**
 * Every error thrown by `@format.dev/zip` (and by compiled documents while building
 * their assets zip) extends this class. The umbrella check lets callers branch
 * once on "this is a zip-side failure", then narrow further by `code`.
 *
 * Mirrors `FormatError` from `@format.dev/client`: a single class to catch, a
 * `code` field to dispatch on.
 */
export type FormatZipErrorCode =
	| 'MISSING_ASSET'
	| 'UNRESOLVABLE_REF'
	| 'ASSET_MISMATCH'
	| 'INVALID_EXTENSION'
	| 'REMOTE_ASSETS_DISABLED'
	| 'REMOTE_ASSET_FETCH'

export class FormatZipError extends Error {
	constructor(
		public readonly code: FormatZipErrorCode,
		message: string,
		options?: ErrorOptions
	) {
		super(message, options)
	}
}

export class MissingAssetError extends FormatZipError {
	constructor(public relPath: string) {
		super('MISSING_ASSET', `Asset not found: ${relPath}`)
	}
}

/**
 * Thrown by `zip()` when the HTML references a local asset that resolves to no
 * file: an empty `src`/`href`/`url("")`, or one like `/`, `.`, or `..` that
 * points at the bundle root (a directory) rather than a file. A same-document
 * fragment (`url(#gradient)`) is not this: it names an element already in the
 * document and is skipped silently. Reported with a warning instead of thrown
 * when `skipMissing` is set.
 */
export class UnresolvableRefError extends FormatZipError {
	constructor(public ref: string) {
		const reason = ref.trim() === '' ? 'it is empty' : 'it resolves to the bundle root, not a file'
		super('UNRESOLVABLE_REF', `Unresolvable asset reference ${JSON.stringify(ref)}: ${reason}`)
	}
}

export interface AssetMismatchDetail {
	documentName: string
	mode: 'static' | 'dynamic'
	missing: string[]
	known: string[]
	/**
	 * Remote (http/https) URLs the HTML references. The render-time check attaches
	 * these so a later step can find broken remotes even when local assets are
	 * already missing — they are referenced, not yet known to be unreachable.
	 */
	remoteRefs?: string[]
	/** Remote URLs that could not be loaded, filled in once they have been probed. */
	brokenRemote?: string[]
}

const toBullets = (items: string[]) => items.map(item => `- ${item}`).join('\n')

function buildAssetMismatchMessage(detail: AssetMismatchDetail): string {
	const { documentName, mode, missing, known, brokenRemote = [] } = detail

	const sections = [`Missing assets for document "${documentName}"`]

	if (missing.length) {
		sections.push(`Missing local assets:\n${toBullets(missing)}`)
	}

	if (brokenRemote.length) {
		sections.push(`Unreachable remote assets:\n${toBullets(brokenRemote)}`)
	}

	if (known.length) {
		sections.push(`Known assets:\n${toBullets(known)}`)
	}

	if (missing.length) {
		// In dynamic mode the asset is genuinely absent, so the static-only escape
		// hatch (switching to dynamic) does not apply — only suggest it for static.
		const placement =
			"Add the missing files to your shared assets folder (`sharedAssetsDir`) or the document's `assets` folder"

		sections.push(
			mode === 'dynamic'
				? `${placement}.`
				: `${placement}, or consider using dynamic assets. Check the CLI options for \`--assets\`.`
		)
	}

	if (brokenRemote.length) {
		sections.push('Make sure the remote assets are reachable when the document is built.')
	}

	return sections.join('\n\n')
}

/**
 * Thrown by a compiled document wrapper when rendered HTML references assets
 * the bundle cannot supply: local files not in its known-asset set, or remote
 * URLs that could not be loaded. Carries enough context for the consumer to fix
 * the source: add the file to the shared assets folder or the document's
 * `./assets/` folder, switch asset mode, or make the remote URL reachable.
 */
export class AssetMismatchError extends FormatZipError {
	public documentName: string
	public mode: 'static' | 'dynamic'
	public missing: string[]
	public known: string[]
	public remoteRefs: string[]
	public brokenRemote: string[]

	constructor(detail: AssetMismatchDetail) {
		super('ASSET_MISMATCH', buildAssetMismatchMessage(detail))

		this.name = 'AssetMismatchError'
		this.documentName = detail.documentName
		this.mode = detail.mode
		this.missing = detail.missing
		this.known = detail.known
		this.remoteRefs = detail.remoteRefs ?? []
		this.brokenRemote = detail.brokenRemote ?? []
	}
}

export class InvalidExtensionError extends FormatZipError {
	constructor(
		public url: string,
		public mimeType?: string
	) {
		super('INVALID_EXTENSION', `Cannot infer asset extension from URL and MIME type: ${url} (${mimeType})`)
	}
}

/**
 * Thrown by `zip()` when the HTML references remote (http/https) assets and
 * `remoteAssets` is not enabled. PDF generation never fetches remote
 * references at render time, so a zip built without them produces a broken
 * PDF — failing loudly here makes the gap visible at the source.
 */
export class RemoteAssetsDisabledError extends FormatZipError {
	constructor(public urls: string[]) {
		super(
			'REMOTE_ASSETS_DISABLED',
			`Cannot fetch remote assets.\n\n` +
				`Your HTML references the following remote assets:\n${toBullets(urls)}\n\n` +
				`Use \`remoteAssets.enabled\` to fetch assets, or use local assets (recommended).`
		)
	}
}

/**
 * Thrown when a remote asset cannot be fetched because the network itself
 * failed (offline machine, DNS failure, blocked egress, timeout) — as opposed
 * to the server answering with an error status. The message is written for the
 * common trap: a CI runner with no outbound network access.
 */
export class RemoteAssetFetchError extends FormatZipError {
	constructor(
		public url: string,
		cause?: unknown
	) {
		super(
			'REMOTE_ASSET_FETCH',
			`Could not fetch remote asset "${url}". The machine running this build needs network access to that host`,
			{ cause }
		)
	}
}
