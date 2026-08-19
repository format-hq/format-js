export type { ZipOptions } from '@format.dev/types'

/** Header forms accepted for remote asset requests. Mirrors the standard `HeadersInit`. */
export type RequestHeaders = Headers | Record<string, string> | [string, string][]

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
