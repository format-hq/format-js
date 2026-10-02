// `isDev`/`isProd` are imported by Studio, where
// there is no `process` global. The browser build replaces the static
// `process.env.NODE_ENV` reads with literals via `define`, so those stay safe —
// but VITEST/VITEST_WORKER_ID are not in that define list, so reading them
// evaluates a bare `process` and throws `ReferenceError: process is not defined`.
// It only surfaced once a production browser build stopped short-circuiting on
// the NODE_ENV checks. Guarding on `process` existing keeps Vitest detection
// working in Node while staying inert in the browser.
function isVitest(): boolean {
	if (typeof process === 'undefined') {
		return false
	}

	return Boolean(process.env.VITEST || process.env.VITEST_WORKER_ID)
}

export function isDev(): boolean {
	if (process.env.NODE_ENV === 'development') {
		return true
	}

	if (process.env.NODE_ENV === 'test') {
		return true
	}

	return isVitest()
}

export function isProd(): boolean {
	return process.env.NODE_ENV === 'production'
}
