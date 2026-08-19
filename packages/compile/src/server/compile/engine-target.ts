// The released engine version targeted by documents this build produces.
// Compile overwrites whatever an SDK stamped, so this is the value that reaches
// the API. HTML documents have no SDK to stamp them at all, so this is their
// only source of one.
//
// The build supplies `FORMAT_ENGINE_TARGET`. It has to arrive as a free
// identifier, because `define` substitutes those and not import bindings; see
// build/release/README.md.
declare const FORMAT_ENGINE_TARGET: string

export const engineTarget: string = FORMAT_ENGINE_TARGET

/**
 * The two `define` entries a renderer build needs so its output names the
 * engine.
 *
 * A compiled wrapper reads `_FMT_ENGINE_VERSION_`. The other entry,
 * `FORMAT_ENGINE_TARGET`, covers an SDK bundled from source, whose own
 * build-time substitution never ran. Both come from here so a single document
 * cannot carry two answers.
 */
export function engineDefines(version: string = engineTarget): Record<string, string> {
	return {
		_FMT_ENGINE_VERSION_: JSON.stringify(version),
		FORMAT_ENGINE_TARGET: JSON.stringify(version)
	}
}
