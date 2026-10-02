/**
 * Build a minimal environment for the render worker process.
 *
 * Starts from an empty object and adds only what the worker strictly needs.
 * No prefixes, no pattern matching — just an explicit allowlist.
 */

const SAFE_KEYS = new Set([
	// React/Vue use this to switch between development and production behavior
	'NODE_ENV',

	// Enables verbose logging (debug-level output, adaptor diagnostics, etc.)
	'FORMAT_DEBUG',

	// Vite and native addons need HOME for cache directories and config resolution
	'HOME',

	// System PATH is needed for external tools (sass, etc.) invoked by plugins
	'PATH',

	// Tells the subprocess which sandbox mode to apply (strict, standard, or absent)
	'FMT_SANDBOX_MODE'
])

export function buildSafeEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	const safe: NodeJS.ProcessEnv = {}

	for (const [key, value] of Object.entries(source)) {
		if (value === undefined) continue

		if (SAFE_KEYS.has(key)) {
			safe[key] = value
		}
	}

	return safe
}
