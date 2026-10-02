// Shared by both builds. Keep Node imports and globals in the Node entry.
import { API_PREFIX, DEFAULTS, REGION_MAP } from './constants'
import type { FormatOptions } from './types'

export function isWebReadable(x: any): x is ReadableStream<Uint8Array> {
	return typeof globalThis.ReadableStream !== 'undefined' && x != null && typeof (x as any).getReader === 'function'
}

export function isBlobLike(x: any): x is Blob {
	return (
		x != null &&
		typeof x === 'object' &&
		typeof (x as any).arrayBuffer === 'function' &&
		typeof (x as any).stream === 'function' &&
		typeof (x as any).size === 'number' &&
		typeof (x as any).type === 'string'
	)
}

/**
 * The API origin requests go to. `environmentBaseUrl` is the `FORMAT_BASE_URL`
 * the Node build reads from its environment. The web build does not read
 * environment variables, so it passes nothing.
 */
export function resolveBaseUrl(opts: FormatOptions, environmentBaseUrl?: string) {
	const baseUrl =
		opts.baseUrl ?? (opts.region ? REGION_MAP[opts.region] : undefined) ?? environmentBaseUrl ?? DEFAULTS.baseUrl

	return baseUrl.replace(/\/+$/, '') // strip trailing slash
}

/** The render endpoint under an API origin. The origin carries no version, so the prefix is added here. */
export function renderUrl(baseUrl: string): string {
	return `${baseUrl}${API_PREFIX}/render`
}

/** The `tags` form field: trimmed, empty tags dropped, duplicates removed, sent as a JSON array. */
export function serializeTags(tags: string[]): string {
	return JSON.stringify(Array.from(new Set(tags.map(t => t.trim()).filter(Boolean))))
}

// extract suggested filename from Content-Disposition
export function parseFilenameFromContentDisposition(header: string | null): string | undefined {
	if (!header) return

	// RFC 5987: filename*=UTF-8''file%20name.pdf
	const mExt = header.match(/filename\*\s*=\s*([^;]+)/i)
	if (mExt) {
		const v = mExt[1].trim()
		const m = /^([A-Za-z0-9._-]+)''(.+)$/.exec(v) // charset'lang'value
		if (m) {
			const value = stripQuotes(m[2])
			try {
				return decodeURIComponent(value)
			} catch {
				return value
			}
		}
	}

	// quoted filename="a;b.pdf"
	const mQuoted = header.match(/filename\s*=\s*"([^"]*)"/i)
	if (mQuoted) return mQuoted[1]

	// bare filename=a.pdf
	const mBare = header.match(/filename\s*=\s*([^;]+)/i)
	if (mBare) return mBare[1].trim()

	return
}

// parse and normalize MIME (strip params, lowercase)
export function parseContentType(header: string | null): string | undefined {
	if (!header) {
		return
	}

	const [mime] = header.split(';', 1)
	return mime?.trim().toLowerCase()
}

export async function safeJson(body: string) {
	try {
		return JSON.parse(body)
	} catch {
		return { raw: body }
	}
}

export function firstHeader(header: string | string[] | null): string | undefined {
	return Array.isArray(header) ? header[0] : header || undefined
}

export function timeoutSignal(ms: number, reason = new Error('Timeout')): AbortSignal {
	if ((AbortSignal as any).timeout) {
		return AbortSignal.timeout(ms)
	}

	const ac = new AbortController()

	setTimeout(() => ac.abort(reason), ms)

	return ac.signal
}

export function anySignal(signals: AbortSignal[]): AbortSignal {
	if ((AbortSignal as any).any) {
		return AbortSignal.any(signals)
	}

	const ac = new AbortController()
	const aborted = signals.find(signal => signal.aborted)
	if (aborted) {
		ac.abort(aborted.reason)
		return ac.signal
	}

	const onAbort = (event: Event) => {
		for (const signal of signals) signal.removeEventListener('abort', onAbort)
		ac.abort((event.target as AbortSignal).reason)
	}

	for (const s of signals) {
		s.addEventListener('abort', onAbort, { once: true })
	}

	return ac.signal
}

export function getAbortErrorOrElse(signal: AbortSignal | undefined, cause?: unknown): Error {
	return signal?.aborted
		? signal.reason instanceof Error
			? signal.reason
			: new Error('Aborted with unknown reason')
		: new Error(cause instanceof Error ? cause.message : 'Unknown internal error', { cause })
}

export function concatUint8Array(parts: Uint8Array[], total: number): Uint8Array {
	if (parts.length === 1 && parts[0].byteLength === total) {
		return parts[0]
	}

	let offset = 0
	const out = new Uint8Array(total)

	for (const p of parts) {
		out.set(p, offset)
		offset += p.byteLength
	}

	return out
}

/**
 * The key a client sends, or a thrown error naming how to supply one.
 * `environmentApiKey` is the `FORMAT_API_KEY` the Node build reads from its
 * environment. The web build passes nothing, so its callers have to
 * pass `apiKey` explicitly.
 */
export function resolveApiKey(
	explicitApiKey: string | undefined,
	environmentApiKey?: string,
	howToSupply?: string
): string {
	if (explicitApiKey) {
		return explicitApiKey
	}

	if (environmentApiKey) {
		return environmentApiKey
	}

	throw new Error(`Format API key is required. ${howToSupply ?? 'Pass `apiKey` explicitly.'}`)
}

function stripQuotes(input: string): string {
	if (input.length >= 2 && input[0] === '"' && input[input.length - 1] === '"') return input.slice(1, -1)
	return input
}
