import type { ZipOptions } from './types'

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'
import { deflateLevel } from './zip'
import { isSystemJunkFile } from './junk-files'
import { ZIP_EPOCH } from './constants'

/**
 * Zip the entire contents of a directory, preserving relative paths as entry
 * names ('/'-separated). No HTML scanning — this is the static-asset-mode
 * builder: every known asset ships, so any render works. Only OS-generated
 * junk (`.DS_Store`, `Thumbs.db`, and friends) is skipped.
 *
 * Node-only (reads the filesystem).
 *
 * @returns the archive bytes, or `undefined` when the directory is missing or
 *   empty — callers write no zip at all for asset-less documents.
 */
export async function zipDir(dir: string, options?: ZipOptions): Promise<Uint8Array | undefined> {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])

	const files: Record<string, Uint8Array> = {}

	for (const entry of entries) {
		if (!entry.isFile() || isSystemJunkFile(entry.name)) {
			continue
		}

		const absolute = join(entry.parentPath, entry.name)
		const entryName = relative(dir, absolute).split('\\').join('/')

		files[entryName] = new Uint8Array(await readFile(absolute))
	}

	if (Object.keys(files).length === 0) {
		return undefined
	}

	// Sort entries so output is independent of filesystem readdir order.
	const ordered: Record<string, Uint8Array> = {}
	for (const name of Object.keys(files).sort()) {
		ordered[name] = files[name]
	}

	return zipSync(ordered, { level: deflateLevel(options), mtime: ZIP_EPOCH })
}
