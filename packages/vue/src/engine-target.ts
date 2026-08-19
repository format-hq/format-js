// The released engine version targeted by documents built from this package.
// Each build supplies `FORMAT_ENGINE_TARGET` for itself, so the same source can
// be built against different engines. It has to arrive as a free identifier,
// because `define` substitutes those and not import bindings; see
// build/release/README.md.
declare const FORMAT_ENGINE_TARGET: string

export const engineTarget: string = FORMAT_ENGINE_TARGET
