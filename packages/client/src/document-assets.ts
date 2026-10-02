import { getAbortErrorOrElse } from './helpers'
import type { FormatDocument } from './types'

/**
 * A compiled document cannot cancel its asset lookup. Reject promptly on abort
 * and cancel any stream that arrives afterwards so its source can release it.
 */
export async function documentAssets(
	doc: FormatDocument,
	signal: AbortSignal
): Promise<ReadableStream<Uint8Array> | undefined> {
	if (signal.aborted) throw getAbortErrorOrElse(signal)
	const pending = doc.getAssetsWebStream()

	return new Promise((resolve, reject) => {
		const onAbort = () => {
			signal.removeEventListener('abort', onAbort)
			reject(getAbortErrorOrElse(signal))
		}
		signal.addEventListener('abort', onAbort, { once: true })
		if (signal.aborted) onAbort()
		pending.then(
			stream => {
				signal.removeEventListener('abort', onAbort)
				if (signal.aborted) {
					void stream?.cancel(signal.reason).catch(() => {})
					return
				}
				resolve(stream)
			},
			error => {
				signal.removeEventListener('abort', onAbort)
				reject(error)
			}
		)
	})
}
