// The release version this CLI belongs to. A scaffolded project pins its Format
// dependencies to it, so the project gets the set that was tested together.
//
// Not the engine version, which documents carry and which moves independently.
// The build supplies `FORMAT_JS_VERSION`. It has to arrive as a free identifier,
// because `define` substitutes those and not import bindings; see
// build/release/README.md.
declare const FORMAT_JS_VERSION: string

export const jsVersion: string = FORMAT_JS_VERSION
