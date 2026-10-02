// Web-standard entry: runs anywhere with web APIs (browsers, workers, edge,
// Deno, Node 18+). No `node:*` imports and no filesystem. `zip()` scans HTML
// with node-html-parser (browser-safe) and takes a resolver — use
// `urlResolver(map)` or your own. This is what the compiled dynamic-mode
// wrapper imports, so its bundle carries the parser; static-mode wrappers
// import only `scanAssetRefs` (the lighter regex check) and stay lean.

export { zip, listZipEntries, readRemoteAssets, mergeRemoteAssets } from './zip'
export { urlResolver } from './url-resolver'
export { fetchRemote, fetchRemoteIfChanged, findBrokenRemoteAssets } from './helpers'
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
export type {
	AssetResolver,
	RemoteAsset,
	RemoteAssetFetcher,
	RemoteValidators,
	StoredRemoteAsset,
	ZipOptions
} from './types'
export type { AssetMismatchDetail, FormatZipErrorCode } from './errors'
