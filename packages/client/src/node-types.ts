import type { createWriteStream } from 'node:fs'
import type { Readable } from 'node:stream'
import type {
	AssetLike as WebAssetLike,
	FormatPdfOptions as WebFormatPdfOptions,
	FormatResponse as WebFormatResponse
} from './types'

export type { FormatDocument, FormatOptions, FormatRegion } from './types'

/**
 * Accepts the web asset types, plus Node.js `Buffer` and `Readable` streams,
 * including `ReadStream` from `fs.createReadStream`.
 */
export type AssetLike = WebAssetLike | Readable
export type WriteStreamOptions = Extract<Parameters<typeof createWriteStream>[1], object>

export type FormatPdfOptions = Omit<WebFormatPdfOptions, 'assets'> & {
	/**
	 * Override the document's assets stream. Use this when you build the assets zip at runtime
	 * instead of relying on the compile-time output.
	 * @example fs.createReadStream('./assets.zip')
	 */
	assets?: AssetLike
}

export type FormatResponse = WebFormatResponse & {
	/**
	 * Save the PDF stream directly to a file. Creates parent directories if they don't exist.
	 * @platform node
	 * @example await response.toFile('./output/invoice.pdf')
	 */
	toFile(filePath: string, options?: WriteStreamOptions): Promise<{ path: string; bytes: number }>
}
