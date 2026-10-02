// Response handling shared by the Node and web builds.
import { FormatError } from './error'
import { concatUint8Array, parseContentType, parseFilenameFromContentDisposition, safeJson } from './helpers'
import type { FormatResponse } from './types'

/**
 * The error a non-2xx response becomes.
 *
 * Reads at most about 1MB of the body, so an unexpectedly large error response
 * cannot exhaust memory, and parses it as JSON where it can. A body that is not
 * JSON arrives as `{ raw: body }`.
 */
export async function formatErrorFrom(res: Response): Promise<FormatError> {
	const status = res.status ?? 0

	// read at most ~1MB of error body to avoid unbounded memory usage
	let size = 0
	const limit = 1_000_000
	const chunks: Uint8Array[] = []
	const reader = res.body?.getReader()

	try {
		if (reader) {
			while (size < limit) {
				const { done, value } = await reader.read()
				if (done || !value?.length) break
				chunks.push(value)
				size += value.byteLength
			}
		}
	} finally {
		try {
			await reader?.cancel()
		} catch {
			// ignore
		}
	}

	// avoid Buffer.concat so we are web/browser-friendly
	const buf = concatUint8Array(chunks, size)
	const body = new TextDecoder('utf-8', { fatal: false }).decode(buf)
	const detail = await safeJson(body)

	return new FormatError(status, detail)
}

/** What a successful response says about the PDF, read from its headers. */
function responseDetails(res: Response): Omit<FormatResponse, keyof Response> {
	const rawContentLength = res.headers.get('content-length')
	const contentType = parseContentType(res.headers.get('content-type'))

	return {
		filename: parseFilenameFromContentDisposition(res.headers.get('content-disposition')),
		contentLength: rawContentLength ? parseInt(rawContentLength) : undefined,
		contentType,
		traceparent: res.headers.get('traceparent') || undefined,
		isPdf: contentType === 'application/pdf'
	}
}

/**
 * Assign to the Response itself: a Proxy breaks the native methods' brand
 * checks in browsers and Node 24.
 */
export function augmentResponse(res: Response): FormatResponse {
	return Object.assign(res, responseDetails(res))
}
