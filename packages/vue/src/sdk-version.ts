// The Format release this package belongs to, written into every document it
// renders as `data-sdk`. It names the SDK/toolchain that produced the markup,
// which is a different question from the engine that will lay it out
// (`data-engine`) and from the client that will submit it.
//
// Each build supplies `FORMAT_JS_VERSION` for itself, so the same source can be
// built at different release numbers. It has to arrive as a free identifier,
// because `define` substitutes those and not import bindings; see
// build/release/README.md.
declare const FORMAT_JS_VERSION: string

export const sdkVersion: string = FORMAT_JS_VERSION
