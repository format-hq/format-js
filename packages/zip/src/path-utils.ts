// Minimal POSIX-style path helpers, dependency-free and runtime-portable.
// `node:path` is unavailable in browsers and workers, so the shared zip core
// can't reach for it. These cover only what the pipeline needs: normalize,
// parse, and join, all operating on '/'-separated paths.

/** Collapse '.', '..', and duplicate slashes, mirroring `path.posix.normalize`. */
export function normalizePath(input: string): string {
	const isAbsolute = input.startsWith('/')
	const out: string[] = []

	for (const segment of input.split('/')) {
		if (segment === '' || segment === '.') {
			continue
		}

		if (segment === '..') {
			const canPop = out.length > 0 && out[out.length - 1] !== '..'

			if (canPop) {
				out.pop()
			} else if (!isAbsolute) {
				out.push('..')
			}

			continue
		}

		out.push(segment)
	}

	const joined = out.join('/')

	if (isAbsolute) {
		return '/' + joined
	}

	return joined || '.'
}

/** Split a path into dir/name/ext, mirroring `path.posix.parse`. */
export function parsePath(input: string): { dir: string; name: string; ext: string } {
	const lastSlash = input.lastIndexOf('/')
	const dir = lastSlash >= 0 ? input.slice(0, lastSlash) : ''
	const base = lastSlash >= 0 ? input.slice(lastSlash + 1) : input

	const lastDot = base.lastIndexOf('.')

	// A leading dot is part of the name (e.g. '.env'), so ignore dot at index 0.
	if (lastDot <= 0) {
		return { dir, name: base, ext: '' }
	}

	return { dir, name: base.slice(0, lastDot), ext: base.slice(lastDot) }
}

/** Join and normalize '/'-separated segments, mirroring `path.posix.join`. */
export function joinPath(...segments: string[]): string {
	return normalizePath(segments.filter(Boolean).join('/'))
}

/**
 * Small, fast, non-cryptographic hash (FNV-1a, 32-bit) rendered as 8 hex chars.
 * Used only to give a remote asset's query string a stable, collision-resistant
 * filename suffix — it is not security-sensitive.
 */
export function hash8(input: string): string {
	let hash = 0x811c9dc5

	for (let index = 0; index < input.length; index++) {
		hash ^= input.charCodeAt(index)
		hash = Math.imul(hash, 0x01000193)
	}

	return (hash >>> 0).toString(16).padStart(8, '0')
}
