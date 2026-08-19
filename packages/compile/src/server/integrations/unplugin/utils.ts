import { isAbsolute, relative, resolve, posix } from 'path'

export function sanitiseSubdir(input?: string): string | undefined {
	if (!input) {
		return undefined
	}

	let rel = input.replace(/\\/g, '/').trim()

	if (!rel) {
		return undefined
	}

	if (rel.startsWith('/') || isAbsolute(rel)) {
		return undefined
	}

	rel = rel.replace(/^\.\/+/, '')

	rel = posix.normalize(rel)

	rel = rel
		.split('/')
		.filter(seg => seg && seg !== '..')
		.join('/')

	return rel || undefined
}

export function safeRelPath(
	outRootAbs: string,
	subdir: string | undefined,
	file: string
): { rel: string; abs: string } {
	const rel = subdir ? posix.join(subdir, file) : file
	const abs = resolve(outRootAbs, rel)
	const back = relative(outRootAbs, abs).replace(/\\/g, '/')

	if (back.startsWith('..') || back.startsWith('../')) {
		// clamp to outRoot if traversal occurred
		return { rel: file, abs: resolve(outRootAbs, file) }
	}

	return { rel, abs }
}

export function cleanId(id: string): string {
	// remove leading \0 used by adapters and strip query/hash
	const noZero = id.startsWith('\0') ? id.slice(1) : id
	const q = noZero.indexOf('?')
	const h = noZero.indexOf('#')
	const cut = (x: number, y: number) => (x === -1 ? y : y === -1 ? x : Math.min(x, y))
	const end = cut(q, h)
	return end === -1 ? noZero : noZero.slice(0, end)
}

export function addZeroPrefix(id: string): string {
	return id.startsWith('\0') ? id : `\0${id}`
}

export function stripPrefix(id: string, prefix: string): string | null {
	const cid = cleanId(id)

	if (cid.startsWith(prefix)) {
		return cid.slice(prefix.length)
	}

	return null
}
