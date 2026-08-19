# Variable fonts in PDFs: bloat, the clip, and the weight mismatch

_Investigation, last updated 2026-06-08. Every claim here is backed by a measurement or a viewable PDF (see [Evidence PDFs](#evidence-pdfs))._

> **Outcome.** This investigation settled the default. Format embeds static instances by default (`compact`) for small, deterministic files, and ships the variable masters as an opt-in (`fidelity`) for viewer-consistent weight and exact optical sizing. The shipped design and the author API live in the [package README](./README.md).

## TL;DR

Format's built-in families (Sans = Adwaita, Serif = FMT Crimson Pro, Mono = JetBrains Mono) are **variable fonts**. In PDFs, that causes a chain of issues, and — importantly — the fixes **trade off against each other**. There is no single option that is small, optically size-aware, _and_ renders identically in every viewer. The real decision is **file size vs rendering fidelity**.

Three distinct effects, each proven below:

1. **Type 3 bloat** — Skia cannot subset a variable font; it emits every glyph as a Type 3 outline procedure. ~4× larger per face, ~100KB on a full document.
2. **The clip** — the old press matched the variable via **fontconfig**, where Chromium _ignores_ the `opsz` axis and renders the wide default (opsz 14); the preview used `@font-face`, where Chromium _applies_ `opsz auto` (narrower at large sizes). The PDF was wider than the preview → trailing glyphs clipped.
3. **The weight mismatch (static regression)** — switching to **static** instances embeds them as CID TrueType, which CoreGraphics-based viewers (macOS Preview/Quick Look) **stem-darken**, while Type 3 (the variable) is drawn as plain paths and escapes it. So the static PDF looks _heavier_ in Preview than the variable did.

## The four embed/render combinations

| Path                                                              | PDF embedding           | `opsz` behaviour                                  | Notes                                                                |
| ----------------------------------------------------------------- | ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Variable via **fontconfig** (old press)                           | **Type 3**              | **ignored** → stuck at default **opsz 14** (wide) | bloat **and** the clip — worst case                                  |
| Variable via **`@font-face`** (preview, and the fix for the clip) | **Type 3**              | **`opsz auto`** → tracks size                     | correct rendering, still bloated                                     |
| **Static** instance (`@font-face`/`local()`)                      | **CID TrueType** subset | fixed (whatever opsz it was instanced at)         | small + deterministic, but CID gets stem-darkened; loses `opsz auto` |
| Static, demand-instanced per run                                  | CID TrueType subset     | exact per run                                     | small + size-aware, **still** CID stem-darkening                     |

## Finding 1 — variable → Type 3, unconditionally

Skia's PDF backend can't embed a variable instance as a subset, so it falls back to Type 3 (each glyph a filled-path procedure). Source: [`src/pdf/SkPDFFont.cpp`](https://skia.googlesource.com/skia/+/main/src/pdf/SkPDFFont.cpp) — the first thing `FontType()` checks is `kVariable_FontFlag`, returning `kOther_Font` (`// force Type3 fallback`).

`pdffonts`, same heading:

| Source                                | type             | objects | size        |
| ------------------------------------- | ---------------- | ------- | ----------- |
| variable (ttf or woff2, `@font-face`) | **Type 3**       | 6       | ~22 KB      |
| variable (fontconfig system)          | **Type 3**       | 6       | ~25 KB      |
| **static instance**                   | **CID TrueType** | 1       | **~5.5 KB** |

It is unconditional for the variable — `opsz auto`, `optical-sizing: none`, the bare default instance, and explicit `font-variation-settings` all still emit Type 3.

## Finding 2 — the clip is the fontconfig `opsz` path, not "variable" per se

Two separate facts combine:

- **`opsz` changes advance width** (~9% via HVAR), measured directly from the font (string = "The quick brown fox jumps over the lazy dog."): opsz 14 → 21.6855 em, opsz 24 → 20.5923 em, opsz 32 → 19.7207 em. The static `FormatSans-400` cut equals the variable at opsz 14 **exactly** (21.6855 em) — instancing is correct.
- **Chromium applies `opsz` only via `@font-face`, not via fontconfig.** For a fontconfig-matched _system_ variable font, variations are ignored entirely — measured at 60px, identical string: `bare = forced opsz 14 = forced opsz 32 = opsz auto = 1276.3px`. So it renders the **default opsz 14** (wide), regardless of size or any CSS.

So the old press (fontconfig → opsz 14, wide) produced text wider than the preview (`@font-face` → `opsz auto`, narrow at headings), and the page clipped the overflow. Demonstrated in **[`00-original-clip-fontconfig-vs-fontface.pdf`](#evidence-pdfs)**: same heading, fontconfig row = **817.4px**, `@font-face` opsz-auto row = **753px** (8.5% wider), both Type 3.

This means the clip is fixable **without** going static — just load the variable via `@font-face` consistently in both the preview and press.

## Finding 3 — static (CID) is stem-darkened; variable (Type 3) is not

This is why the variable _looked fine_ before and the static looks _heavier_ now. A Type 3 font is content-stream path **fills** — the rasterizer's font engine applies no hinting/stem-darkening to it. A CID TrueType is a real **font**, so CoreGraphics-based viewers (macOS Preview, Quick Look) stem-darken it, especially at small sizes.

Measured on a single PDF containing both, **identical outlines** (opsz 14, wght 400), ink coverage per row:

| rasterizer                            | variable (Type 3) | static (CID)  | difference             |
| ------------------------------------- | ----------------- | ------------- | ---------------------- |
| **CoreGraphics / `sips`** (≈ Preview) | 4,243,635         | **4,945,031** | **CID +16.5% heavier** |
| Quick Look thumbnail                  | 4,272,995         | 4,260,110     | ≈ equal                |

So it's **viewer-dependent**: the CoreGraphics PDF path darkens CID more than Type 3; Chrome's pdfium renders the CID light (≈ the browser). It's also **inherent to embedding a real font** — demand-driven instancing wouldn't fix it (still CID), and stem-darkening is a viewer/OS decision the font file doesn't control. Only Type 3 dodges it, and Type 3 is the bloat. See **[`01-type3-vs-cid-stem-darkening.pdf`](#evidence-pdfs)** (open in Preview vs Chrome).

## Finding 4 — a single static cut can't reproduce `opsz auto`

The variable's `opsz auto` tracks the font size continuously (clamped 14–32). A static instance is one fixed optical size, so it matches the variable only at that exact size; everywhere else it diverges in width _and_ stroke contrast. The default `Format Sans` is the opsz-14 (text) cut, so headings render wider/heavier than the variable would. See **[`02-optical-size-variable-vs-static.pdf`](#evidence-pdfs)**. Approximating `opsz auto` with static cuts needs the engine to pick a cut by size (Text/Display, or an opsz palette), or demand-driven instancing — none of which fix Finding 3.

## The decision

The clip is fixable either way, so the real trade is **size vs fidelity**:

- **Keep variable, load via `@font-face` everywhere** — no clip, `opsz auto` preserved, Type 3 means consistent weight across viewers (no stem-darkening). **Cost: ~100KB Type 3 bloat per PDF.**
- **Static (current build)** — small, deterministic, no clip. **Cost: loses `opsz auto`, and CID is stem-darkened heavier in macOS Preview** (fine in Chrome's viewer / other platforms).
- **Demand-instanced static** — small + size-aware, but still CID (stem-darkening remains) and a large engine feature.

There is no "small + Preview-consistent" option, because only Type 3 escapes stem-darkening and Type 3 is the bloat.

## Evidence PDFs

In `~/Downloads/font-rendering-evidence/` (regeneratable; open each in **macOS Preview** _and_ **Chrome's PDF viewer** to see the viewer-dependence):

- **`00-original-clip-fontconfig-vs-fontface.pdf`** — same heading, fontconfig (opsz 14, wide, 817px) vs `@font-face` opsz-auto (narrow, 753px). Both Type 3. The clip cause.
- **`01-type3-vs-cid-stem-darkening.pdf`** — identical outlines as Type 3 (variable) vs CID (static), 13–28px. CID renders heavier in Preview, ≈ equal in Chrome.
- **`02-optical-size-variable-vs-static.pdf`** — variable `opsz auto` vs static opsz 14 / opsz 32 across 14–72px; the variable shifts between the cuts as size grows.

## Ruled out (with evidence)

- **It's not a different/wrong font.** The dyno woff2, the press ttf, and the variable master are the same Adwaita; the static cut matches the variable at the same opsz to 0.01px.
- **It's not `-webkit-font-smoothing`.** That makes the _browser_ greyscale to match the PDF; removing it would make the browser heavier (see `apps/web/content/docs/miscellaneous/font-rendering.mdx`). It does not affect the PDF.
- **It's not the cpdf scale step** (`scaleX = scaleY = 1.0` for integer page dims) or the zoom-10 supersampling (vector text is unaffected).
- **It's not synthesis or a wrong weight cut** — `pdffonts` shows the correct per-weight CID cuts in the static PDFs.

## Reproduce

- Embed type: render text and `pdffonts out.pdf` — variable → `Type 3`, static → `CID TrueType`.
- Stem-darkening: rasterize the _same_ PDF via `sips` (light, ≈ browser/pdfium) and `qlmanage -t` (Quick Look) / Preview (heavy for CID), and compare ink.
- fontconfig opsz: install the variable as a system font, match by family name (no `@font-face`), and measure — width is identical for bare / `opsz auto` / forced opsz (variations ignored, stuck at opsz 14).
- Load fonts over **HTTP with `goto`**, never `file://` + `setContent` (relative `@font-face url()`s silently fall back to a system font — this produced several misleading measurements during the investigation).

## Sources

- [`src/pdf/SkPDFFont.cpp`](https://skia.googlesource.com/skia/+/main/src/pdf/SkPDFFont.cpp) — `kVariable_FontFlag` → Type 3.
- [Skia — PDF Theory of Operation](https://skia.org/docs/dev/design/pdftheory/) — "non-TrueType → Type 3".
- [LibreOffice 108497 — "Instantiate OpenType variable fonts when embedding in PDF"](https://bugs.documentfoundation.org/show_bug.cgi?id=108497).
- `apps/web/content/docs/miscellaneous/font-rendering.mdx` — why `-webkit-font-smoothing: antialiased` is forced (browser↔PDF, not the cause here).
