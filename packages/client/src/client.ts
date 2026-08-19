import { Readable } from 'node:stream'
import { FormData } from 'formdata-node'
import { FormDataEncoder } from 'form-data-encoder'
import {
	anySignal,
	assetsToFormDataValue,
	concatUint8Array,
	extendResponse,
	getAbortErrorOrElse,
	isNode,
	parseContentType,
	parseFilenameFromContentDisposition,
	resolveBaseUrl,
	safeJson,
	timeoutSignal,
	resolveApiKey
} from './helpers'
import { FormatError } from './error'
import { CLIENT_IDENTIFIER, DEFAULTS, API_PREFIX } from './constants'
import type { FormatOptions, FormatDocument, FormatPdfOptions, FormatResponse, WriteStreamOptions } from './types'

export class FormatClient {
	private readonly baseUrl: string
	private readonly renderTimeoutMs: number
	private readonly apiKey: string

	constructor(opts: FormatOptions) {
		this.apiKey = resolveApiKey(opts.apiKey)
		this.baseUrl = resolveBaseUrl(opts)
		this.renderTimeoutMs = opts.renderTimeoutMs ?? 120_000
	}

	async pdf(doc: string | FormatDocument, options?: FormatPdfOptions): Promise<FormatResponse> {
		// `doc` is either raw document model HTML (hand-authored / non-studio flows) or a
		// FormatDocument from studio's compile output
		const isFormatDoc = typeof doc !== 'string'
		const html = isFormatDoc ? doc.html : doc

		const form = new FormData()
		form.set('html', html)

		if (options?.tags) {
			const clean = Array.from(new Set(options.tags.map(t => t.trim()).filter(Boolean)))
			form.set('tags', JSON.stringify(clean))
		}

		// `getAssetsWebStream()` is the single source of truth: a stream means
		// attach it, `undefined` means this render has no assets, and a throw
		// (e.g. the rendered HTML references assets the bundle can't supply)
		// propagates to the caller with full context.
		let assets = options?.assets
		if (!assets && isFormatDoc) {
			assets = (await doc.getAssetsWebStream()) ?? undefined
		}

		if (assets) {
			form.set('assets', assetsToFormDataValue(assets))
		}

		const encoder = new FormDataEncoder(form)
		const headers = {
			...encoder.headers,
			Authorization: `Bearer ${this.apiKey}`,
			'User-Agent': DEFAULTS.userAgent,
			'X-Format-Client': CLIENT_IDENTIFIER
		}

		let res: Response
		const renderTimeoutSignal = timeoutSignal(this.renderTimeoutMs)
		const combinedSignal = options?.signal ? anySignal([options.signal, renderTimeoutSignal]) : renderTimeoutSignal

		try {
			res = await fetch(`${this.baseUrl}${API_PREFIX}/render`, {
				method: 'POST',
				headers,
				body: Readable.toWeb(Readable.from(encoder)) as any,
				signal: combinedSignal,
				duplex: 'half' as any
			} as any)
		} catch (err) {
			console.error(err)
			throw getAbortErrorOrElse(combinedSignal, (err as Error).message)
		}

		const status = res.status ?? 0

		if (!res.ok) {
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

			throw new FormatError(status, detail)
		}

		const filename = parseFilenameFromContentDisposition(res.headers.get('content-disposition'))
		const rawContentLength = res.headers.get('content-length')
		const contentLength = rawContentLength ? parseInt(rawContentLength) : undefined
		const contentType = parseContentType(res.headers.get('content-type'))
		const traceparent = res.headers.get('traceparent') || undefined
		const isPdf = contentType === 'application/pdf'

		const toFile = async (filePath: string, options?: WriteStreamOptions) => {
			if (!isNode()) {
				throw new Error('"toFile" is only available in Node environments')
			}

			if (res.bodyUsed) {
				throw new Error('Response body already consumed')
			}

			if (!res.body) {
				throw new Error('Response body is empty')
			}

			const [{ pipeline }, { createWriteStream }, fs, path] = await Promise.all([
				import('node:stream/promises'),
				import('node:fs'),
				import('node:fs/promises'),
				import('node:path')
			])

			await fs.mkdir(path.dirname(filePath), { recursive: true })
			const nodeReadable = Readable.fromWeb(res.body as any)
			const outStream = createWriteStream(filePath, { mode: options?.mode })
			await pipeline(nodeReadable, outStream)
			const stats = await fs.stat(filePath)
			return { path: filePath, bytes: stats.size }
		}

		return extendResponse(res, {
			toFile,
			filename,
			contentLength,
			contentType,
			traceparent,
			isPdf
		})
	}
}
