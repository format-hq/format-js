export type Document = {
	name: string
	variants: string[]
	extension: string
	// Max mtime (ms) across the document's top-level files and data variants,
	// for recency sorting and "edited Xm ago" labels. Null/absent when unknown.
	lastModified?: number | null
}

export type DocumentAssetType = 'image' | 'font' | 'other'

export interface DocumentAsset {
	// Path relative to its assets dir, e.g. `logo.svg` or `fonts/Inter.woff2`.
	path: string
	size: number
	type: DocumentAssetType
	source: 'document' | 'shared'
}
