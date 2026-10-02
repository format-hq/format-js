export const EXTENSION_TO_MIME_MAP = {
	// format-level
	html: 'text/html',
	js: 'text/javascript',
	mjs: 'text/javascript',
	wasm: 'application/wasm',
	webmanifest: 'application/manifest+json',

	// user-level
	css: 'text/css',
	json: 'application/json',
	ttf: 'font/ttf',
	otf: 'font/otf',
	woff: 'font/woff',
	woff2: 'font/woff2',
	eot: 'application/vnd.ms-fontobject',
	png: 'image/png',
	jpg: 'image/jpg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	bmp: 'image/bmp',
	tiff: 'image/tiff',
	avif: 'image/avif',
	tif: 'image/tiff',
	heic: 'image/heic',
	heif: 'image/heif'
} as const

export const EXCLUDED_EXTENSIONS = ['js', 'mjs', 'wasm', 'webmanifest'] as const

export type FormatAssetsMimeExtension = keyof typeof EXTENSION_TO_MIME_MAP

export type ExcludedExtensions = (typeof EXCLUDED_EXTENSIONS)[number]

export type UserAssetsMimeExtension = Exclude<FormatAssetsMimeExtension, ExcludedExtensions>

export const MIME_TYPE: Readonly<Record<FormatAssetsMimeExtension, string>> = EXTENSION_TO_MIME_MAP

export type MimeType = (typeof MIME_TYPE)[FormatAssetsMimeExtension]

export const USER_MIME_TYPE: Readonly<Record<UserAssetsMimeExtension, string>> = Object.fromEntries(
	Object.entries(EXTENSION_TO_MIME_MAP).filter(([ext]) => !EXCLUDED_EXTENSIONS.includes(ext as ExcludedExtensions))
) as Readonly<Record<UserAssetsMimeExtension, string>>

export const FORMAT_MIME_TYPE = MIME_TYPE

export const EXT_TO_MIME: Readonly<Record<string, string>> = Object.fromEntries(
	Object.entries(EXTENSION_TO_MIME_MAP).map(([ext, mime]) => [`.${ext}`, mime])
)

export const MIME_TO_EXT: Readonly<Record<string, string>> = Object.fromEntries(
	Object.entries(EXTENSION_TO_MIME_MAP).map(([ext, mime]) => [mime, `.${ext}`])
) as Readonly<Record<string, string>>

export function getPermittedContentType(ext: string): string | undefined {
	const normalized = ext.startsWith('.') ? ext : `.${ext}`
	return EXT_TO_MIME[normalized]
}

export function isFormatAssetExtension(ext: string): ext is FormatAssetsMimeExtension {
	return ext in FORMAT_MIME_TYPE
}

export function isUserAssetExtension(ext: string): ext is UserAssetsMimeExtension {
	return ext in USER_MIME_TYPE
}
