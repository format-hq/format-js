import { Readable } from 'stream'
import { File as FormDataFile } from 'formdata-node'
import { DEFAULTS, REGION_MAP } from './constants'
import { AssetLike, FormatOptions, FormatResponse } from './types'

type FileLike = {
	name: string
	type: string
	readonly [Symbol.toStringTag]: 'File'
	stream(): ReadableStream<Uint8Array>
}

type FileLikeForFormData = FormDataFile | FileLike

function toFileLike(webStream: ReadableStream<Uint8Array>, name: string, type: string): FileLike {
	return {
		name,
		type,
		[Symbol.toStringTag]: 'File' as const,
		stream() {
			return webStream
		}
	}
}

function isWebReadable(x: any): x is ReadableStream<Uint8Array> {
	return typeof globalThis.ReadableStream !== 'undefined' && x != null && typeof (x as any).getReader === 'function'
}

function isNodeReadable(x: any): x is Readable {
	return x != null && typeof (x as any).pipe === 'function' && typeof (x as any).read === 'function'
}

function isBlobLike(x: any): x is Blob {
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
 * Normalize assets into something FormData#set accepts (File or File-like)
 * whilst retaining multipart streaming where possible
 */
export function assetsToFormDataValue(
	input: AssetLike,
	filename = 'assets.zip',
	mime = 'application/zip'
): FileLikeForFormData {
	// blob - wrap as File to ensure a filename
	if (isBlobLike(input)) {
		return new FormDataFile([input as any], filename, { type: mime })
	}

	// bytes
	if (input instanceof Uint8Array || input instanceof ArrayBuffer || Buffer?.isBuffer?.(input)) {
		return new FormDataFile([input], filename, { type: mime })
	}

	// web ReadableStream
	if (isWebReadable(input)) {
		return toFileLike(input, filename, mime)
	}

	// node Readable
	if (isNodeReadable(input)) {
		const webStream = Readable.toWeb(input) as unknown as ReadableStream<Uint8Array>
		return toFileLike(webStream, filename, mime)
	}

	throw new TypeError('Unsupported assets type')
}

export function resolveBaseUrl(opts: FormatOptions) {
	const baseUrl =
		opts.baseUrl ??
		(opts.region ? REGION_MAP[opts.region] : undefined) ??
		process.env.FORMAT_BASE_URL ??
		DEFAULTS.baseUrl

	return baseUrl.replace(/\/+$/, '') // strip trailing slash
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

	for (const s of signals) {
		s.addEventListener('abort', () => ac.abort(s.reason), { once: true })
	}

	return ac.signal
}

export function getAbortErrorOrElse(signal: AbortSignal | undefined, orElse?: string): Error {
	return signal?.aborted
		? signal.reason instanceof Error
			? signal.reason
			: new Error('Aborted with unknown reason')
		: new Error(orElse || 'Unknown internal error')
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

export function isNode(): boolean {
	return typeof process !== 'undefined' && !!process.versions?.node
}

export function extendResponse(res: Response, extras: Omit<FormatResponse, keyof Response>): FormatResponse {
	return new Proxy(res, {
		get(target, prop, receiver) {
			if (prop in extras) return (extras as any)[prop]
			return Reflect.get(target, prop, receiver)
		},
		has(target, prop) {
			return prop in extras || prop in target
		},
		ownKeys(target) {
			const extraKeys = Reflect.ownKeys(extras)
			const targetKeys = Reflect.ownKeys(target)
			return Array.from(new Set([...targetKeys, ...extraKeys]))
		},
		getOwnPropertyDescriptor(target, prop) {
			if (prop in extras) {
				return (
					Object.getOwnPropertyDescriptor(extras, prop as keyof FormatResponse) ?? {
						configurable: true,
						enumerable: true,
						writable: true,
						value: (extras as any)[prop]
					}
				)
			}
			return Object.getOwnPropertyDescriptor(target, prop)
		}
	}) as FormatResponse
}

export function resolveApiKey(explicitApiKey?: string): string {
	if (explicitApiKey) {
		return explicitApiKey
	}

	if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
		const value = process.env.FORMAT_API_KEY

		if (value) {
			return value
		}
	}

	throw new Error('Format API key is required. Pass `apiKey` explicitly or set `FORMAT_API_KEY` in your environment.')
}

function stripQuotes(input: string): string {
	if (input.length >= 2 && input[0] === '"' && input[input.length - 1] === '"') return input.slice(1, -1)
	return input
}
