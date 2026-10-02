// The web entry. Bundlers select it through the `browser` export condition
// on the package's main export. It exports the same names as index.ts.
export type { AssetLike, FormatDocument, FormatOptions, FormatPdfOptions, FormatRegion, FormatResponse } from './types'
export { FormatClient } from './web-client'
export { FormatError } from './error'
