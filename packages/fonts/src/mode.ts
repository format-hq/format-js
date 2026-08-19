export type FontVariant = 'static' | 'variable'

/** Author-facing font strategy, set on `<Document fonts>`. */
export type FontMode = 'fidelity' | 'compact'

/**
 * The mode an unset or unrecognised `fonts` value resolves to. Compact embeds
 * static instances (CID subset): smaller files, one fixed optical size. Most
 * documents take this default. Fidelity is the opt-in for exact optical sizing
 * and viewer-consistent weight, at a larger file.
 */
export const DEFAULT_FONT_MODE: FontMode = 'compact'

/**
 * Resolve the author-facing mode to an embedding variant. Fidelity embeds the
 * variable masters (Type 3: exact optical sizing, identical weight in every
 * viewer); compact embeds static instances (CID subset: smaller files, fixed
 * optical size). An absent or unknown value resolves to DEFAULT_FONT_MODE.
 *
 * This is the one definition of the mapping and the default, so the previews,
 * press, and Studio can never disagree on either. It has no Node imports, so
 * a browser preview can call it without pulling the filesystem-backed helpers in
 * `css.ts`.
 */
export function variantForMode(mode?: string | null): FontVariant {
	const resolved = mode === 'fidelity' || mode === 'compact' ? mode : DEFAULT_FONT_MODE
	return resolved === 'fidelity' ? 'variable' : 'static'
}
