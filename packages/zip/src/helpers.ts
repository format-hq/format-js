import type { RequestHeaders } from './types'

import { MIME_TO_EXT } from '@format.dev/utils'
import { InvalidExtensionError, RemoteAssetFetchError } from './errors'
import { USER_AGENT } from './constants'
import { normalizePath, parsePath, joinPath, hash8 } from './path-utils'

/**
 * Fetch a remote asset and return its bytes plus parsed MIME type.
 *
 * Uses `fetch` + `arrayBuffer()` rather than a Node stream so the remote path
 * stays portable across Node, workers, and browsers.
 *
 * @throws {RemoteAssetFetchError} when the network itself fails (offline, DNS,
 *   blocked egress, timeout). HTTP error statuses throw a plain Error — the
 *   server was reachable, so it's a different problem.
 */
export async function fetchRemote(params: {
	url: string
	headers?: RequestHeaders
	timeoutMs?: number
}): Promise<{ bytes: Uint8Array; mimeType?: string }> {
	const { url, headers: requestHeaders, timeoutMs = 15_000 } = params

	const signal = AbortSignal.timeout(timeoutMs)
	const headers = new Headers(requestHeaders)

	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', USER_AGENT)
	}

	let res: Response

	try {
		res = await fetch(url, { signal, redirect: 'follow', headers })
	} catch (cause) {
		throw new RemoteAssetFetchError(url, cause)
	}

	if (!res.ok) {
		throw new Error(`HTTP ${res.status} for ${url}`)
	}

	const bytes = new Uint8Array(await res.arrayBuffer())
	const mimeType = parseContentType(res.headers.get('content-type') || undefined)

	return { bytes, mimeType }
}

/**
 * Probe each remote URL and return the ones that can't be loaded — a failed
 * request or a non-OK status, the same "broken" definition `fetchRemote` uses.
 * Collects every failure rather than stopping at the first, so callers can report
 * the full set. Runs the probes concurrently.
 */
export async function findBrokenRemoteAssets(params: {
	urls: string[]
	headers?: RequestHeaders
	timeoutMs?: number
}): Promise<string[]> {
	const { urls, headers, timeoutMs } = params

	const results = await Promise.all(
		urls.map(async url => {
			try {
				await fetchRemote({ url, headers, timeoutMs })
				return null
			} catch {
				return url
			}
		})
	)

	return results.filter((url): url is string => url !== null)
}

// parse and normalize MIME (strip params, lowercase)
export function parseContentType(header?: string): string | undefined {
	if (!header) {
		return
	}

	const [mime] = header.split(';', 1)
	return mime?.trim().toLowerCase()
}

// note: for simplicity, we are ignoring protocol-relative URLs
export function isRemoteOrigin(href: string) {
	try {
		const url = new URL(href)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

export function isSameOrigin(href: string, base: string) {
	try {
		const url = new URL(href, base)
		return url.origin === base
	} catch {
		// invalid url syntax
		return false
	}
}

// A random, unguessable origin used to detect local (relative) references:
// anything that resolves against it is local. `crypto.randomUUID` is a
// web-standard global (browsers, workers, Node 18+); the fallback covers the
// rare runtime without it. This is not security-sensitive.
function randomLocalOrigin(): string {
	const uuid = globalThis.crypto?.randomUUID?.()

	if (uuid) {
		return `https://${uuid}`
	}

	return `https://local-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

const LOCAL_ORIGIN_BASE = randomLocalOrigin()
export const isLocalOrigin = (href: string) => isSameOrigin(href, LOCAL_ORIGIN_BASE)

// turn something like "/a/../b///./c" into "b/c" safely
export function normalizeDir(rawDir: string): string {
	// force an absolute base so ".." can't climb above root
	// and normalize to collapse ".", "..", and duplicate slashes
	const abs = normalizePath('/' + rawDir.replace(/^\/+/, ''))
	// drop the leading "/" to make it relative again for zip entry joining
	return abs === '/' ? '' : abs.slice(1)
}

// a deterministic, safe zip entry path for a remote URL
export function urlToZipName(url: string, mimeType?: string): string {
	const u = new URL(url)

	if (u.protocol !== 'http:' && u.protocol !== 'https:') {
		throw new Error(`Unsupported protocol: ${u.protocol}`)
	}

	// ensure a filename even for trailing slashes
	let pathname = u.pathname
	if (pathname.endsWith('/')) {
		pathname += 'index'
	}

	let { dir, name, ext } = parsePath(pathname)

	if (!ext && mimeType) {
		ext = MIME_TO_EXT[mimeType.toLowerCase()]
	}

	if (!ext) {
		throw new InvalidExtensionError(url, mimeType)
	}

	// order-insensitive stable query hash
	const qs = [...u.searchParams.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`)
		.join('&')
	const queryHash = qs ? `__${hash8(qs)}` : ''

	// sanitize filename segment (replace any character that is not a word char, a dot, or a hyphen)
	const hostname = u.hostname.toLowerCase()
	const port = `_${u.port || (u.protocol === 'https:' ? '443' : '80')}`
	const safeDir = normalizeDir(dir)
	const safeName = `${name.replace(/[^\w.-]/g, '_')}${queryHash}${ext}`

	return joinPath('remote', `${hostname}${port}`, safeDir, safeName)
}

export function resolveLocalUrl(href: string) {
	const url = new URL(href, LOCAL_ORIGIN_BASE)
	return url.pathname.replace('/', '')
}

/**
 * Resolve a local href to a safe, POSIX-style relative path for a zip entry.
 * - Strips query/hash
 * - Resolves dot-segments relative to baseRel
 * - Drops leading slashes
 * - Normalizes duplicate slashes
 *
 * Returns `null` for a ref that names no file to bundle: a bare fragment
 * (`#gradient`), a `data:` URL, or anything that resolves to the bundle root
 * itself. This is a pure path helper — what a null means (skip a fragment, or
 * report a broken `src`/`href`/`url()`) is the caller's policy, not this
 * function's.
 */
export function resolveLocalRef(href: string, baseRel = '.'): string | null {
	// a fragment points at an element already in the document, and a data: URL
	// carries its bytes inline — neither is a file on disk
	if (href.startsWith('#') || href.startsWith('data:')) {
		return null
	}

	// build a base URL whose pathname reflects the referring file's location
	// e.g. baseRel = "css/app/main.css" -> base pathname "/css/app/main.css"
	const base = new URL('/' + normalizePath(baseRel), LOCAL_ORIGIN_BASE)
	const url = new URL(href, base)

	// get normalized pathname and make it relative (no leading slash)
	let pathname = url.pathname.replace(/^\/+/, '') // drop all leading slashes
	pathname = normalizePath(pathname) // collapse duplicate slashes, ".", etc

	// normalizePath returns "." for an empty path, i.e. the ref resolved to the
	// bundle root — a directory, never a file to bundle
	if (pathname === '.') {
		return null
	}

	return pathname
}
