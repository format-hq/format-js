// The two release numbers this compiler stamps into every document it produces.
//
// `sdkVersion` is J, the Format release the compiler itself belongs to, written
// as `data-sdk`. It names the toolchain that produced the markup.
// `engineTarget` is E, the released engine that release targets, written as
// `data-engine`. It names the engine that must lay the document out.
//
// Documents authored as HTML have no SDK to stamp them, so this is their only
// source of either. A document an SDK did stamp is checked against these two
// rather than relabelled — see ./finalize-document-html.
//
// The build supplies `FORMAT_JS_VERSION` and `FORMAT_ENGINE_TARGET`. Both have
// to arrive as free identifiers, because `define` substitutes those and not
// import bindings; see build/release/README.md.
declare const FORMAT_JS_VERSION: string
declare const FORMAT_ENGINE_TARGET: string

export const sdkVersion: string = FORMAT_JS_VERSION

export const engineTarget: string = FORMAT_ENGINE_TARGET

/**
 * The `define` entries a renderer build needs so its output names both the
 * release that produced it and the engine it targets.
 *
 * Two spellings of each number, because a renderer bundle holds two kinds of
 * code. The compiled wrapper reads `_FMT_JS_VERSION_` and
 * `_FMT_ENGINE_VERSION_`; an SDK bundled from source rather than installed
 * reads `FORMAT_JS_VERSION` and `FORMAT_ENGINE_TARGET`, whose own build-time
 * substitution never ran. All four come from here, so a single document cannot
 * carry two answers to either question — and in particular an SDK aliased to
 * source can never disagree with the wrapper that finalises its output.
 */
export function producerDefines(sdk: string = sdkVersion, engine: string = engineTarget): Record<string, string> {
	return {
		_FMT_JS_VERSION_: JSON.stringify(sdk),
		_FMT_ENGINE_VERSION_: JSON.stringify(engine),
		FORMAT_JS_VERSION: JSON.stringify(sdk),
		FORMAT_ENGINE_TARGET: JSON.stringify(engine)
	}
}
