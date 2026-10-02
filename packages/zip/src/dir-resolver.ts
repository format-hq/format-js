import type { AssetResolver } from './types'

import { join, resolve, sep } from 'node:path'
import { readFile } from 'node:fs/promises'

/**
 * Node-only resolver that reads asset paths from a filesystem directory.
 * Returns `null` for any path that does not resolve to a readable file, or that
 * resolves outside the directory (path-traversal guard).
 *
 * This is what the Node `zip(html, dir)` overload uses under the hood, and the
 * compile-time resolver. It pulls in `node:fs`, so it lives in its own module
 * and is never reachable from the `@format.dev/zip/web` entry.
 */
export function dirResolver(dir: string): AssetResolver {
	const root = resolve(dir)

	return async relPath => {
		const target = resolve(join(root, relPath))
		const escapesRoot = target !== root && !target.startsWith(root + sep)

		if (escapesRoot) {
			return null
		}

		try {
			return new Uint8Array(await readFile(target))
		} catch (error) {
			// missing (ENOENT), a directory (EISDIR), or a non-directory in the
			// path (ENOTDIR) all mean the ref names no readable file here
			const code = (error as NodeJS.ErrnoException).code
			if (code === 'ENOENT' || code === 'EISDIR' || code === 'ENOTDIR') {
				return null
			}

			throw error
		}
	}
}
