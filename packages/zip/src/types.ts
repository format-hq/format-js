export type { RemoteAssetFetcher, ZipOptions } from '@format.dev/types'

/** Header forms accepted for remote asset requests. Mirrors the standard `HeadersInit`. */
export type RequestHeaders = Headers | Record<string, string> | [string, string][]

/** The response headers a server offers for asking later whether an asset changed. */
export interface RemoteValidators {
	etag?: string
	lastModified?: string
}

export interface RemoteAsset {
	bytes: Uint8Array
	mimeType?: string
	validators: RemoteValidators
}

/** A remote asset already inside an archive, as `readRemoteAssets` returns it. */
export interface StoredRemoteAsset {
	url: string
	bytes: Uint8Array
}

/**
 * Resolves a referenced asset path to its bytes. Returns `null` when there is
 * no asset for that path. `zip()` treats this as missing (and throws, unless
 * `skipMissing` is set).
 *
 * A resolver is the single seam through which `zip()` reaches the filesystem,
 * a URL map, or any other store, which is what keeps the package portable
 * across Node, workers, and browsers. `dirResolver` (Node) and `urlResolver`
 * (web) are the built-ins; pass your own for anything else.
 */
export type AssetResolver = (relPath: string) => Promise<Uint8Array | null>
