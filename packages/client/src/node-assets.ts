// Asset normalisation for the Node build only. It imports Node's stream module
// and formdata-node, which the web build must never bundle.
import { Readable } from 'stream'
import { File as FormDataFile } from 'formdata-node'
import { isBlobLike, isWebReadable } from './helpers'
import type { AssetLike } from './node-types'

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

function isNodeReadable(x: any): x is Readable {
	return x != null && typeof (x as any).pipe === 'function' && typeof (x as any).read === 'function'
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
