#!/usr/bin/env python3
"""
Build @format.dev/fonts dist from the variable masters declared in manifest.json.

Each variable family is instanced into a static weight palette (every `weightStep`),
Sans additionally in two optical cuts (Text / Display). Every static cut is emitted
in two deliveries:
  - woff2  -> served via `url()` by the previews (Studio/Dyno).
  - ttf    -> installed as a system font and referenced via `src: local(<PostScript>)`
             by press (no per-request fetch/decode; one mmap'd typeface reused).
The variable masters are also emitted (opt-in path), and the already-static families
(Emoji/Math/Tofu) are copied through: woff2 (+ unicode-range subsets for Emoji) for
`url()`, and the TTF master for `local()`.

Each static face is re-emmed onto a power-of-two em (STATIC_UPEM) when it isn't
already on one, so Chromium's print-to-PDF packs its glyphs into runs instead of
placing each one individually; see reem() and the README. Only the 1000-em faces
move (Mono, and the STIX-derived Math face); the power-of-two faces (Serif 1024,
Sans 2048) already pack and pass through, and the variable masters keep their
source em (the PDF embeds them as Type 3, per-glyph regardless of the em).

Name tables are rebranded to the durable `Format ...` identity. The script writes
fonts/fonts.json — the descriptor list (family, weight, style, optical, deliveries,
woff2, ttf, postscriptName, unicodeRange?) that src/css.ts turns into @font-face
rules, so the names/paths live in exactly one place.

Regen only (fonts/ is committed). Requires: pip install -r requirements.txt
"""
import json, os, shutil
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "fonts")
WIN, MAC = (3, 1, 0x409), (1, 0, 0)
# a face whose em is not a power of two is re-emmed onto this. Chromium packs a
# glyph run into one PDF show only when each glyph lands exactly where
# advance*size/upem predicts, which is exact in binary float only when the em is
# a power of two (and the size is a whole pixel). a 1000-unit em — JetBrains Mono
# and STIX Math ship one — drifts on every glyph, so Skia falls back to a
# per-glyph move+show and the text bytes triple. faces already on a power of two
# (Serif 1024, Sans 2048) already pack and are left untouched. 1024 packs
# equally; 2048 is the conventional re-em target and rounds advances finer.
STATIC_UPEM = 2048
WEIGHT_NAMES = {100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
                500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black"}


def rel(p):
    return os.path.join(ROOT, p)


def set_names(font, family, subfamily, ps_name):
    """Rebrand the name table to the Format-prefixed identity (durable name)."""
    name = font["name"]
    full = f"{family} {subfamily}".strip()
    for pid, eid, lid in (WIN, MAC):
        name.setName(family, 1, pid, eid, lid)
        name.setName(subfamily, 2, pid, eid, lid)
        # ID 3 = Unique font identifier. The source value carries the origin
        # (e.g. "4.001;...;InterVariable-Regular", "...;JetBrainsMono-Regular");
        # OFL doesn't protect it (unlike the copyright/license/trademark records,
        # which we keep), and a derivative should mint its own so two fonts never
        # share an id. The per-face PostScript name is unique across our cuts.
        name.setName(ps_name, 3, pid, eid, lid)
        name.setName(full, 4, pid, eid, lid)
        name.setName(ps_name, 6, pid, eid, lid)
        # ID 25 = Variations PostScript Name Prefix. The masters inherit it from
        # their source (Adwaita=Inter -> "InterVariable", Crimson Pro, JetBrains);
        # a renderer that honours it would prefix synthesised variation names
        # with the source identity. Rebrand it to the same string as ID 6 so it
        # matches Chrome/Skia, which prefixes from ID 6. Inert on the fully
        # pinned static cuts (no fvar) but rewritten there too so no source
        # string survives anywhere in the name table.
        name.setName(ps_name, 25, pid, eid, lid)
        name.setName(family, 16, pid, eid, lid)
        name.setName(subfamily, 17, pid, eid, lid)


def strip_instance_ps_names(font):
    """Drop every `fvar` named instance's PostScript name so the renderer
    synthesises a uniform `<ID 6>_<axes>` name at any coordinate.

    The masters ship one named instance per weight (at opsz 14 for Sans), each
    with its own source-branded PostScript name (e.g. `InterVariable-SemiBold`,
    `FMTCrimsonPro-Bold`). Chrome/Skia emit that instance name verbatim into the
    PDF when the live opsz/wght land exactly on an instance — a 12px / weight-600
    run clamps opsz to the axis floor (14) and so hits the 600 instance, leaking
    `InterVariable-SemiBold`. Clearing the id forces synthesis from the rebranded
    ID 6, matching the name off-instance coordinates already get.
    """
    if "fvar" not in font:
        return
    fvar = font["fvar"]
    name = font["name"]
    # Records still referenced after we clear the PostScript ids — never remove
    # these (instance/axis labels share the >=256 id space with the PS names).
    referenced = {inst.subfamilyNameID for inst in fvar.instances}
    referenced |= {a.axisNameID for a in fvar.axes}
    stale = {inst.postscriptNameID for inst in fvar.instances
             if inst.postscriptNameID not in (0, 0xFFFF)} - referenced
    for inst in fvar.instances:
        inst.postscriptNameID = 0xFFFF
    for nid in stale:
        name.removeNames(nameID=nid)


def reem(font):
    """Re-em a plain-outline face onto STATIC_UPEM, and report whether it did.

    No-op (returns False) when the face is already on a power-of-two em — its
    glyph runs already pack — or carries a COLR table: colour faces (Emoji, Tofu)
    embed per-glyph in the PDF regardless of the em, and scale_upem covers their
    paint graphs less thoroughly. Tofu's em belongs in its generator (the tofu
    package), not here; Emoji is external and already 1024.

    scale_upem rescales the glyf outlines, hmtx advances, GPOS value records
    (kerning/anchors), the MATH table constants, and the head/hhea/OS-2 metrics
    by the same ratio, so the face looks identical — only its internal grid
    changes. It does not rescale the TrueType hinting tables
    (cvt/fpgm/prep/instructions), but our faces carry no em-dependent hinting (the
    only prep is dropout control, which is em-independent) and the PDF path
    applies none anyway, so the re-em is visually lossless.

    glyf coordinates are int16; guard the largest against the 32767 ceiling
    before scaling. No face comes near it (JetBrains Mono peaks ~1735 -> 3553),
    but a re-em that silently overflowed would corrupt outlines.

    Call only on faces with no `fvar` — scale_upem leaves gvar deltas unscaled,
    so a variable master would re-em wrong. Every face here is static.
    """
    old = font["head"].unitsPerEm
    if (old & (old - 1)) == 0 or "COLR" in font:
        return False
    glyf = font["glyf"]
    mx = 0
    for gn in font.getGlyphOrder():
        g = glyf[gn]
        if getattr(g, "numberOfContours", 0) > 0:
            mx = max(mx, max((abs(v) for c in g.coordinates for v in c), default=0))
    if mx * STATIC_UPEM // old > 32767:
        raise SystemExit(f"re-em to {STATIC_UPEM} overflows int16: max coord {mx} at upem {old}")
    scale_upem(font, STATIC_UPEM)
    return True


def emit(font, dest_no_ext):
    """Write a TTFont as both woff2 (url) and ttf (local). Returns (woff2_rel, ttf_rel)."""
    os.makedirs(os.path.dirname(dest_no_ext), exist_ok=True)
    font.flavor = None
    font.save(dest_no_ext + ".ttf")
    font.flavor = "woff2"
    font.save(dest_no_ext + ".woff2")
    return os.path.relpath(dest_no_ext + ".woff2", DIST), os.path.relpath(dest_no_ext + ".ttf", DIST)


def weights(spec):
    lo, hi = spec["wght"]
    return list(range(lo, hi + 1, spec["weightStep"]))


def build_static(key, spec, descriptors):
    optical = spec.get("opsz")  # {text, display} or None
    cuts = [("text", spec["family"])] if not optical else [
        ("text", spec["family"]), ("display", spec["displayFamily"])]
    styles = [("normal", spec["regular"], "")] + (
        [("italic", spec["italic"], " Italic")] if spec.get("italic") else [])

    for opt_key, family in cuts:
        for w in weights(spec):
            for style, src, style_suffix in styles:
                font = TTFont(rel(src))
                axes = {"wght": w}
                if optical:
                    axes["opsz"] = optical[opt_key]
                instantiateVariableFont(font, axes, inplace=True, updateFontNames=False)
                font["OS/2"].usWeightClass = w
                reem(font)  # Mono (1000-em) moves to 2048; Serif/Sans already power-of-two
                subfamily = (WEIGHT_NAMES[w] + style_suffix).strip()
                ps = f"{family}-{subfamily}".replace(" ", "")
                set_names(font, family, subfamily, ps)
                italic_tag = "-Italic" if style == "italic" else ""
                base = os.path.join(DIST, "static", key, f"{family.replace(' ', '')}-{w}{italic_tag}")
                woff2, ttf = emit(font, base)
                descriptors.append({
                    "variant": "static", "family": family, "weight": w, "style": style,
                    "optical": opt_key if optical else None, "deliveries": ["url", "local"],
                    "woff2": woff2, "ttf": ttf, "postscriptName": ps,
                })
        print(f"  static {family:20s} {len(weights(spec))}w x {len(styles)} styles")


def build_variable(key, spec, descriptors):
    styles = [("normal", spec["regular"], "")] + (
        [("italic", spec["italic"], " Italic")] if spec.get("italic") else [])
    for style, src, style_suffix in styles:
        font = TTFont(rel(src))
        family = spec["family"]
        subfamily = ("Variable" + style_suffix).strip()
        ps = f"{family}-{subfamily}".replace(" ", "")
        set_names(font, family, subfamily, ps)
        strip_instance_ps_names(font)
        italic_tag = "-Italic" if style == "italic" else ""
        base = os.path.join(DIST, "variable", key, f"{family.replace(' ', '')}{italic_tag}")
        woff2, ttf = emit(font, base)
        descriptors.append({
            "variant": "variable", "family": family, "weightRange": spec["wght"],
            "style": style, "deliveries": ["url", "local"],
            "woff2": woff2, "ttf": ttf, "postscriptName": ps,
        })
    print(f"  variable {family:18s} {len(styles)} styles")


def place(src, dest):
    """Copy a prebuilt static face from src to dest, re-emming it in passing when
    reem() applies (Math is 1000-em; Emoji/Tofu are colour and pass through
    byte-for-byte). Returns the PostScript name (id 6). save() preserves the
    flavor, so a woff2 source is rewritten as woff2."""
    font = TTFont(src)
    ps = font["name"].getDebugName(6)
    if reem(font):
        font.save(dest)
    else:
        shutil.copyfile(src, dest)
    return ps


def copy_static_family(key, spec, descriptors):
    family = spec["family"]
    # url delivery: woff2 (emoji = unicode-range subsets; math/tofu = single file)
    url_files = spec.get("subsets") or [{"file": spec["file"]}]
    for f in url_files:
        out = os.path.join(DIST, key, os.path.basename(f["file"]))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        place(rel(os.path.join("sources", f["file"])), out)
        descriptors.append({
            "variant": "shared", "family": family, "weight": 400, "style": "normal",
            "deliveries": ["url"], "woff2": os.path.relpath(out, DIST),
            **({"unicodeRange": f["unicodeRange"]} if f.get("unicodeRange") else {}),
        })
    # local delivery: the TTF master (one face), referenced by PostScript name
    ttf_src = rel(os.path.join("sources", spec["ttf"]))
    ttf_out = os.path.join(DIST, key, os.path.basename(spec["ttf"]))
    ps = place(ttf_src, ttf_out)
    descriptors.append({
        "variant": "shared", "family": family, "weight": 400, "style": "normal",
        "deliveries": ["local"], "ttf": os.path.relpath(ttf_out, DIST), "postscriptName": ps,
    })
    print(f"  static-family {family:16s} {len(url_files)} url + 1 local ({ps})")


def main():
    manifest = json.load(open(os.path.join(ROOT, "manifest.json")))
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    descriptors = []
    for key, spec in manifest["variable"].items():
        build_static(key, spec, descriptors)
        build_variable(key, spec, descriptors)
    for key, spec in manifest["static"].items():
        copy_static_family(key, spec, descriptors)
    json.dump(descriptors, open(os.path.join(DIST, "fonts.json"), "w"), indent=1)
    total = 0
    for root, _, files in os.walk(DIST):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
    print(f"\nwrote {len(descriptors)} descriptors, {total/1_000_000:.1f}MB -> fonts/")


if __name__ == "__main__":
    main()
