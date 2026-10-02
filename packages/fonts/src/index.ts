export { fontFaceCss, documentFontCss, loadDescriptors, fontsDir } from './css.js'
export type { FontDelivery, FontDescriptor } from './css.js'
export { variantForMode, DEFAULT_FONT_MODE } from './mode.js'
export type { FontVariant, FontMode } from './mode.js'

/**
 * Canonical, durable family names. These are the public contract — the source
 * typeface behind each may change, the name does not. Must stay in sync with the
 * engine's resolved-name table (`packages/engine/src/utils/fonts.rs`).
 *
 * `sansDisplay` exists because Sans is the only family with an `opsz` axis; it is
 * a static-variant family (authors opt into it for large text).
 */
export const FONT_FAMILIES = {
	sans: 'Format Sans',
	sansDisplay: 'Format Sans Display',
	serif: 'Format Serif',
	mono: 'Format Mono',
	emoji: 'Format Emoji',
	math: 'Format Math',
	tofu: 'Format Tofu'
} as const

export type FontFamilyKey = keyof typeof FONT_FAMILIES
