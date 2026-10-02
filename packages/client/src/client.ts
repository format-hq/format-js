import { Readable } from 'node:stream'
import { FormData } from 'formdata-node'
import { FormDataEncoder } from 'form-data-encoder'
import {
	anySignal,
	getAbortErrorOrElse,
	renderUrl,
	resolveBaseUrl,
	timeoutSignal,
	resolveApiKey,
	serializeTags
} from './helpers'
import { assetsToFormDataValue } from './node-assets'
import { augmentResponse, formatErrorFrom } from './response'
import { CLIENT_IDENTIFIER } from './constants'
import { documentAssets } from './document-assets'
import type { FormatOptions, FormatDocument, FormatPdfOptions, FormatResponse, WriteStreamOptions } from './node-types'

const USER_AGENT = `${CLIENT_IDENTIFIER} (${process.platform}) node ${process.version}`

export class FormatClient {
	private readonly baseUrl: string
	private readonly renderTimeoutMs: number
	private readonly apiKey: string

	constructor(opts: FormatOptions = {}) {
		this.apiKey = resolveApiKey(
			opts.apiKey,
			process.env.FORMAT_API_KEY,
			'Pass `apiKey` explicitly or set `FORMAT_API_KEY` in your environment.'
		)
		this.baseUrl = resolveBaseUrl(opts, process.env.FORMAT_BASE_URL)
		this.renderTimeoutMs = opts.renderTimeoutMs ?? 120_000
	}

	async pdf(doc: string | FormatDocument, options?: FormatPdfOptions): Promise<FormatResponse> {
		const renderTimeoutSignal = timeoutSignal(this.renderTimeoutMs)
		const combinedSignal = options?.signal ? anySignal([options.signal, renderTimeoutSignal]) : renderTimeoutSignal

		// `doc` is either raw document model HTML (hand-authored / non-studio flows) or a
		// FormatDocument from studio's compile output
		const isFormatDoc = typeof doc !== 'string'
		const html = isFormatDoc ? doc.html : doc

		const form = new FormData()
		form.set('html', html)

		if (options?.tags) {
			form.set('tags', serializeTags(options.tags))
		}

		// `getAssetsWebStream()` is the single source of truth: a stream means
		// attach it, `undefined` means this render has no assets, and a throw
		// (e.g. the rendered HTML references assets the bundle can't supply)
		// propagates to the caller with full context.
		let assets = options?.assets
		if (!assets && isFormatDoc) {
			assets = await documentAssets(doc, combinedSignal)
		}

		if (assets) {
			form.set('assets', assetsToFormDataValue(assets))
		}

		const encoder = new FormDataEncoder(form)
		const headers = {
			...encoder.headers,
			Authorization: `Bearer ${this.apiKey}`,
			'User-Agent': USER_AGENT,
			'X-Format-Client': CLIENT_IDENTIFIER
		}

		let res: Response
		if (combinedSignal.aborted) throw getAbortErrorOrElse(combinedSignal)

		try {
			res = await fetch(renderUrl(this.baseUrl), {
				method: 'POST',
				headers,
				body: Readable.toWeb(Readable.from(encoder)) as any,
				signal: combinedSignal,
				duplex: 'half' as any,
				// Node 24 otherwise reports a streamed upload's 401 as "fetch failed".
				// This leaves the explicit Authorization header intact.
				credentials: 'omit'
			} as any)
		} catch (err) {
			throw getAbortErrorOrElse(combinedSignal, err)
		}

		if (!res.ok) {
			throw await formatErrorFrom(res)
		}

		const toFile = async (filePath: string, options?: WriteStreamOptions) => {
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

		return Object.assign(augmentResponse(res), { toFile })
	}
}
