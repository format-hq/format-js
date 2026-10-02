import {
	anySignal,
	getAbortErrorOrElse,
	isBlobLike,
	isWebReadable,
	renderUrl,
	resolveApiKey,
	resolveBaseUrl,
	serializeTags,
	timeoutSignal
} from './helpers'
import { augmentResponse, formatErrorFrom } from './response'
import { CLIENT_IDENTIFIER } from './constants'
import { documentAssets } from './document-assets'
import type { AssetLike, FormatOptions, FormatDocument, FormatPdfOptions, FormatResponse } from './types'

const ASSETS_FILENAME = 'assets.zip'
const ASSETS_TYPE = 'application/zip'

// Cancelling the reader releases a stalled read as well as its underlying source.
async function readStream(stream: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>[]> {
	const reader = stream.getReader()
	const onAbort = () => void reader.cancel(signal.reason).catch(() => {})
	const chunks: Uint8Array<ArrayBuffer>[] = []

	signal.addEventListener('abort', onAbort, { once: true })

	try {
		if (signal.aborted) {
			onAbort()
			throw getAbortErrorOrElse(signal)
		}

		for (;;) {
			const { done, value } = await reader.read()
			if (signal.aborted) throw getAbortErrorOrElse(signal)
			if (done) return chunks
			chunks.push(new Uint8Array(value))
		}
	} finally {
		signal.removeEventListener('abort', onAbort)
		reader.releaseLock()
	}
}

/** The assets archive as a Blob for native FormData. */
async function assetsToBlob(input: AssetLike, signal: AbortSignal): Promise<Blob> {
	if (isBlobLike(input)) {
		return input.type === ASSETS_TYPE ? input : new Blob([input], { type: ASSETS_TYPE })
	}

	if (input instanceof ArrayBuffer) {
		return new Blob([input], { type: ASSETS_TYPE })
	}

	if (ArrayBuffer.isView(input)) {
		return new Blob([new Uint8Array(input)], {
			type: ASSETS_TYPE
		})
	}

	if (isWebReadable(input)) {
		return new Blob(await readStream(input, signal), { type: ASSETS_TYPE })
	}

	throw new TypeError('Unsupported assets type. Pass a Blob, an ArrayBuffer, a Uint8Array or a ReadableStream.')
}

export class FormatClient {
	private readonly baseUrl: string
	private readonly renderTimeoutMs: number
	private readonly apiKey: string

	constructor(opts: FormatOptions) {
		this.apiKey = resolveApiKey(opts?.apiKey)
		this.baseUrl = resolveBaseUrl(opts)
		this.renderTimeoutMs = opts.renderTimeoutMs ?? 120_000
	}

	async pdf(doc: string | FormatDocument, options?: FormatPdfOptions): Promise<FormatResponse> {
		// Include asset preparation in the timeout: native FormData needs the
		// complete Blob before the client can send the request.
		const renderTimeoutSignal = timeoutSignal(this.renderTimeoutMs)
		const combinedSignal = options?.signal ? anySignal([options.signal, renderTimeoutSignal]) : renderTimeoutSignal

		const isFormatDoc = typeof doc !== 'string'
		const html = isFormatDoc ? doc.html : doc

		const form = new FormData()
		form.set('html', html)

		if (options?.tags) {
			form.set('tags', serializeTags(options.tags))
		}

		let assets = options?.assets
		if (!assets && isFormatDoc) {
			assets = await documentAssets(doc, combinedSignal)
		}

		if (assets) {
			form.set('assets', await assetsToBlob(assets, combinedSignal), ASSETS_FILENAME)
		}

		// an abort that landed while the form was being built sends nothing
		if (combinedSignal.aborted) throw getAbortErrorOrElse(combinedSignal)

		let res: Response

		try {
			// Let the browser set the multipart boundary. The explicit bearer key
			// authenticates the request. Cookies would prevent wildcard CORS.
			res = await fetch(renderUrl(this.baseUrl), {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'X-Format-Client': CLIENT_IDENTIFIER
				},
				body: form,
				signal: combinedSignal,
				credentials: 'omit',
				mode: 'cors'
			})
		} catch (err) {
			throw getAbortErrorOrElse(combinedSignal, err)
		}

		if (!res.ok) {
			throw await formatErrorFrom(res)
		}

		return augmentResponse(res)
	}
}
