import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { variantForMode, type FontVariant } from './mode.js'

/** Absolute path to the generated font files. Serve this from a static server. */
export const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts')

/**
 * How the bytes reach the browser:
 * - `url`   — served woff2, `src: url(...)`. For the previews (Studio/Dyno); the
 *             end user's machine has no Format fonts installed.
 * - `local` — system TTF, `src: local("<PostScript>")`. For press, where the
 *             cuts are installed in the image — one mmap'd, process-shared typeface,
 *             no per-request fetch/decode.
 */
export type FontDelivery = 'url' | 'local'

export interface FontDescriptor {
	/** `static`/`variable` are variant-specific; `shared` (emoji/math/tofu) belongs to both. */
	variant: 'static' | 'variable' | 'shared'
	family: string
	/** Single CSS weight (static/shared faces). */
	weight?: number
	/** `[min, max]` weight range (variable faces). */
	weightRange?: [number, number]
	style: 'normal' | 'italic'
	/** Sans-only optical cut; `null`/absent for weight-only families. */
	optical?: 'text' | 'display' | null
	/** Which deliveries this face supports. */
	deliveries: FontDelivery[]
	/** woff2 path relative to `fontsDir` (present for `url` faces). */
	woff2?: string
	/** ttf path relative to `fontsDir` (present for `local` faces; install these in the image). */
	ttf?: string
	/** PostScript name for `src: local(...)` (present for `local` faces). */
	postscriptName?: string
	unicodeRange?: string
}

/** The descriptor list emitted by `scripts/build-fonts.py` — the single source the names/paths come from. */
export function loadDescriptors(): FontDescriptor[] {
	return JSON.parse(readFileSync(join(fontsDir, 'fonts.json'), 'utf8')) as FontDescriptor[]
}

/**
 * Generate the `@font-face` CSS for one variant + delivery.
 *
 * `static` emits `Format Sans` (text cuts) + `Format Sans Display` + the Serif/Mono
 * weight palettes; `variable` emits the variable masters (weight ranges, `opsz auto`).
 * Emoji/Math/Tofu are always included. `baseUrl` (the URL `fontsDir` is served under)
 * is required for `url` delivery and ignored for `local`.
 */
export function fontFaceCss(opts: { variant?: FontVariant; delivery?: FontDelivery; baseUrl?: string }): string {
	const variant = opts.variant ?? 'static'
	const delivery = opts.delivery ?? 'url'

	if (delivery === 'url' && !opts.baseUrl) {
		throw new Error('fontFaceCss: `baseUrl` is required for url delivery')
	}
	const base = (opts.baseUrl ?? '').replace(/\/+$/, '')

	const faces = loadDescriptors()
		.filter(d => d.variant === variant || d.variant === 'shared')
		.filter(d => d.deliveries.includes(delivery))

	return faces
		.map(d => {
			const weight = d.weightRange ? `${d.weightRange[0]} ${d.weightRange[1]}` : `${d.weight}`
			const range = d.unicodeRange ? `\n\tunicode-range: ${d.unicodeRange};` : ''
			const src = delivery === 'local' ? `local("${d.postscriptName}")` : `url('${base}/${d.woff2}') format('woff2')`

			return [
				'@font-face {',
				`\tfont-family: '${d.family}';`,
				`\tfont-style: ${d.style};`,
				`\tfont-weight: ${weight};`,
				'\tfont-display: block;',
				`\tsrc: ${src};${range}`,
				'}'
			].join('\n')
		})
		.join('\n')
}

/**
 * Resolve a document's `fonts` mode straight to its `@font-face` CSS — the mode
 * mapping and the CSS generation in one call, so a consumer never composes them
 * itself. press uses `local` delivery (installed system fonts); a preview
 * server that injects its own `<style>` uses `url` delivery with the base URL
 * its woff2 are served under.
 */
export function documentFontCss(
	mode: string | null | undefined,
	opts: { delivery: FontDelivery; baseUrl?: string }
): string {
	return fontFaceCss({ variant: variantForMode(mode), ...opts })
}
