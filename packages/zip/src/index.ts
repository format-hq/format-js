// Node entry (the package default): everything the web entry has, plus
// filesystem support. `zip()` additionally accepts a directory string, so
// `zip(html, dir)` reads assets from disk with no extra wiring.

import type { AssetResolver, ZipOptions } from './types'

import { zip as zipWithResolver } from './zip'
import { dirResolver } from './dir-resolver'

/**
 * Build a ZIP of every asset `html` references.
 *
 * `source` is either a directory path (read from disk via {@link dirResolver})
 * or a custom {@link AssetResolver}. For browser, worker, and edge runtimes,
 * import from `@format.dev/zip/web` instead — that entry takes a resolver only and
 * carries no `node:*` dependencies.
 *
 * @param html - The rendered Format HTML to scan for asset references.
 * @param source - A directory path (Node) or an {@link AssetResolver} returning the bytes for each referenced path.
 * @param options - {@link ZipOptions}: remote-asset fetching, compression level, and missing-asset handling.
 * @returns the archive bytes, or `undefined` when `html` references no assets.
 */
export function zip(
	html: string,
	source: string | AssetResolver,
	options?: ZipOptions
): Promise<Uint8Array | undefined> {
	const resolve = typeof source === 'string' ? dirResolver(source) : source
	return zipWithResolver(html, resolve, options)
}

export { listZipEntries, mergeRemoteAssets } from './zip'
export { zipDir } from './zip-dir'
export { isSystemJunkFile } from './junk-files'
export { dirResolver } from './dir-resolver'
export { urlResolver } from './url-resolver'
export { findBrokenRemoteAssets } from './helpers'
export { scanAssetRefs } from './scan-lite'
export { scanRemoteRefs } from './scan-remote'
export {
	FormatZipError,
	MissingAssetError,
	UnresolvableRefError,
	InvalidExtensionError,
	AssetMismatchError,
	RemoteAssetFetchError,
	RemoteAssetsDisabledError
} from './errors'
export type { AssetResolver, ZipOptions } from './types'
export type { AssetMismatchDetail, FormatZipErrorCode } from './errors'
