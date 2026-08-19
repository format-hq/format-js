# @format.dev/fonts

Format's built-in font families — Sans, Serif, Mono, Emoji, Math, and Tofu — packaged as one source of truth. The previews (Studio, Engine Dyno) and the PDF renderer (press) load their `@font-face` definitions from here, so a document previews with the same typeface the PDF embeds. No metric or optical drift sits between what an author sees and what ships.

This README is the design record for the package; it replaces the earlier planning note. The measurements behind the trade-off below live in [`INVESTIGATION.md`](./INVESTIGATION.md).

## Two ways to embed a variable font

The built-in families are **variable** fonts: each carries its full weight range along an axis, in a single file. A PDF embeds that font in one of two ways, and the two differ in size, optical sizing, and how consistently viewers draw the weight.

- **Variable master → Type 3.** The PDF engine cannot subset a variable font, so it re-expresses every glyph as a Type 3 drawing procedure. The result runs larger — roughly 100 KB across a typical six-face document — but keeps the variable's automatic optical sizing, and every glyph draws as a plain filled path, so the weight stays consistent from one viewer to the next.
- **Static instance → CID subset.** Pinning the axis at one point produces an ordinary static font, which embeds as a compact, subset CID TrueType. The file shrinks, but the instance holds one fixed optical size, and CoreGraphics-based viewers (macOS Preview, Quick Look) stem-darken a real font — heavier strokes than the Type 3 path at the same outline.

No option is small, optically size-aware, _and_ identical across every viewer at once: only Type 3 escapes stem-darkening, and Type 3 is the larger embedding. The full evidence — `pdffonts` output, ink measurements, the `opsz` width data — is in [`INVESTIGATION.md`](./INVESTIGATION.md).

## Choosing a mode

A document picks its strategy through the `fonts` prop, which the renderer maps to a variant:

```tsx
<Document title="Q3 report">…</Document>                   // static instances → CID subset (default)
<Document title="Q3 report" fonts="fidelity">…</Document>   // variable masters → Type 3
```

| `fonts` mode          | Embedding           | File size | Optical sizing      | Weight across viewers |
| --------------------- | ------------------- | --------- | ------------------- | --------------------- |
| `compact` _(default)_ | static → CID subset | small     | one fixed size      | varies by viewer      |
| `fidelity`            | variable → Type 3   | larger    | exact (`opsz auto`) | consistent            |

Left unset, a document renders in `compact`: the platform defaults to small, deterministic files and accepts the fixed optical size. The `fidelity` mode is the opt-in for authors who need exact optical sizing and viewer-consistent weight and accept the larger file. Both modes share the same family names, so the choice changes the embedding alone — author markup never changes. The default lives in one place, `DEFAULT_FONT_MODE` in `src/mode.ts`.

## Compact PDF text

A static cut embeds as a CID subset, and Format writes its text in one of two ways. A run of glyphs becomes one drawing instruction when every glyph lands exactly where its advance width predicts. If a glyph lands even slightly off, the run closes and the writer starts a new one at a fresh position, so the output drifts toward one instruction per glyph and grows to several times its packed size.

A glyph lands exactly only when its advance is exact in binary floating point. That advance is the glyph's stored width times the font size over the units-per-em, and the division is exact only when the units-per-em is a power of two and the size is a whole pixel. Mono's source, JetBrains Mono, carries a 1000-unit em, so the division leaves a remainder that accrues on every glyph, and Format writes a separate instruction for nearly every one.

The build therefore re-ems any static face that isn't already on a power-of-two em onto a 2048-unit grid (`scale_upem` in `build-fonts.py`). Only the internal grid moves: outlines, advances, kerning, and vertical metrics all scale by the same ratio, so the face looks identical, and the largest coordinate shift lands a few thousandths of a pixel at reading size. The two 1000-em faces, Mono and the copied-through Math face, drop from one instruction per glyph to fully packed runs. Serif (1024) and Sans (2048) are already on a power-of-two em, so they pack as-is and pass through. Emoji and Tofu are colour faces the PDF draws per-glyph regardless, so they pass through too; Tofu is Format's own font, so its em is fixed on a power of two in the tofu package's generator, not here. The variable masters keep their source em, since the `fidelity` path embeds them as Type 3 and writes each glyph separately regardless of the em.

## Families

The package exposes seven canonical family names through `FONT_FAMILIES`. These names are the public contract: the source typeface behind a name can change; the name stays fixed. They must also match the engine's resolved-name table in `packages/engine/src/utils/fonts.rs`.

Only Sans (Adwaita) carries an `opsz` axis, so the static variant ships it in two optical cuts — `Format Sans` for text and `Format Sans Display` for headings — and an author selects Display for large text. Serif (FMT Crimson Pro) and Mono (JetBrains Mono) vary by weight alone. Emoji, Math, and Tofu are already static and pass through unchanged.

## Integrating the package

`variantForMode()` maps a document's `fonts` value to the variant (it lives in the Node-free `@format.dev/fonts/mode`, so a browser preview can import it without the filesystem helpers), and `fontFaceCss()` builds the `@font-face` rules for a given variant and delivery. `documentFontCss()` does both in one call, for a server consumer that injects its own `<style>`:

```ts
import { documentFontCss, variantForMode } from '@format.dev/fonts'

documentFontCss(doc.fonts, { delivery: 'local' }) // mode → @font-face CSS, in one call
variantForMode(doc.fonts) // 'fidelity' → 'variable'; anything else (incl. unset) → 'static'
```

Delivery decides where the bytes come from:

- The previews use `url` delivery — woff2 served over HTTP (`src: url(...)`) — because an end user's machine carries no Format fonts.
- press uses `local` delivery — installed system fonts (`src: local("<PostScript>")`) — so the cuts ship in the image and one memory-mapped typeface serves every render with no per-request fetch or woff2 decode.

```ts
// a preview server that injects its own <style>: mode → CSS in one call
documentFontCss(doc.fonts, { delivery: 'url', baseUrl: '/format-assets/fonts' })

// press: cuts installed as system fonts in the image
documentFontCss(doc.fonts, { delivery: 'local' })
```

For bundlers (Vite), the package also ships the two stylesheets prebuilt — `@format.dev/fonts/static.css` and `@format.dev/fonts/variable.css` — each with `url` delivery and relative paths. A bundler preview (the Engine Dyno) imports the one `variantForMode()` selects, and the bundler fingerprints the referenced woff2. A server preview that controls its own `<style>` (Studio) uses `documentFontCss()` instead, so it can swap the variant in place when a document's mode changes.

## Layout

```
sources/        variable masters (Sans/Serif/Mono) + static Emoji/Math/Tofu — the inputs
manifest.json   families, weight ranges and step, optical sizes, emoji unicode-ranges
scripts/
  build-fonts.py   instances, rebrands, re-ems any non-power-of-two face to 2048 (Mono; Math on copy-through), and compresses the masters to woff2 + ttf; copies the static families; writes fonts/fonts.json
  emit-css.mjs     writes fonts/static.css and fonts/variable.css from fonts.json
fonts/          generated, committed: woff2 + ttf, fonts.json descriptors, static.css, variable.css
src/
  mode.ts        FontMode, FontVariant, DEFAULT_FONT_MODE, variantForMode() — pure, no Node imports (the @format.dev/fonts/mode export)
  css.ts         fontFaceCss(), documentFontCss(), loadDescriptors(), fontsDir — Node, reads fonts.json
  index.ts       FONT_FAMILIES + the public re-exports
```

## Regenerating the fonts

`fonts/` is committed, so an ordinary `pnpm build` (JavaScript only) needs no font toolchain. Regenerate after editing a master or the manifest:

```
pip install -r requirements.txt          # fonttools + brotli
pnpm --filter "@format.dev/fonts" build:fonts  # rebuilds fonts/ and re-emits the stylesheets
```

CI runs `pnpm --filter @format.dev/fonts check:fonts`, which fails if `fonts/` is stale.

## Future: demand-driven instancing

The two modes force a choice between small files and exact optical sizing. A third path would remove it: the engine collects the exact `(opsz, wght)` coordinates a document uses, instances those into static subsets at render time, and embeds them as compact CID — small files _and_ per-document optical sizing in one mode. The same stem-darkening as any CID embedding still applies, and the approach needs runtime instancing in the engine, so it stays a future direction rather than a third `fonts` value for now.
