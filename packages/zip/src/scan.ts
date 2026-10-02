// Slim static-mode entry: the runtime known-asset check, and nothing else.
// Web-standard APIs only, like the /web entry, so it runs anywhere — node,
// browsers, workers, edge. Static-mode wrappers import only `scanAssetRefs`
// (the dependency-free regex scanner), so this entry deliberately omits
// `zip()` and therefore never pulls node-html-parser. Keeping it in a separate
// file — rather than relying on the consumer bundler to tree-shake `zip` out
// of the full `@format.dev/zip/web` entry — guarantees the parser ships in
// dynamic-mode bundles only: a prebuilt entry inlines as one module, and its
// CJS-wrapped parser is opaque to downstream dead-code elimination.

export { scanAssetRefs, scanRemoteRefs } from './scan-lite'
export { AssetMismatchError } from './errors'
export type { AssetMismatchDetail } from './errors'
