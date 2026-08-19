import type { NormalizedCompileOptions } from '../../shared/types/public'

import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { isSystemJunkFile } from '@format.dev/zip'

const CACHE_FILE_NAME = '.cache'

/**
 * The options that can change what a compile writes to disk. The cache hash is
 * built from this explicit allowlist rather than the whole options object, so
 * adding a new option that doesn't affect output can't invalidate every
 * existing cache. When adding an option, err on the side of listing it here —
 * a stale cache is worse than an invalidated one.
 *
 * `userBundler` is deliberately absent: its only effect on output is the
 * webpack node-compat rewrite, which callers pass as `webpackNodeCompat` so
 * vite/rollup/esbuild consumers share one cached compile.
 */
const outputAffectingOptionKeys = [
	'documents',
	'external',
	'bundle',
	'assets',
	'output',
	'variants',
	'remoteAssets',
	'inlineRemoteCss',
	'validateSchema',
	'cjs',
	'bundleName',
	'version',
	'clean',
	'outDir',
	'configPath',
	'target',
	'preset',
	'bundleAll',
	'conditions',
	'externalConditions'
] as const satisfies ReadonlyArray<keyof NormalizedCompileOptions>

export interface BuildCacheKeyOptionsArgs {
	options: NormalizedCompileOptions
	/** Whether the webpack node-compat rewrite applies — the only `userBundler` effect on output. */
	webpackNodeCompat: boolean
}

export function buildCacheKeyOptions(args: BuildCacheKeyOptionsArgs): Record<string, unknown> {
	const { options, webpackNodeCompat } = args

	const picked = Object.fromEntries(outputAffectingOptionKeys.map(key => [key, options[key]]))

	return { ...picked, webpackNodeCompat }
}

interface FileEntry {
	path: string
	mtimeMs: number
	size: number
}

async function walkDir(dir: string): Promise<FileEntry[]> {
	const results: FileEntry[] = []

	try {
		const entries = await readdir(dir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = resolve(dir, entry.name)

			if (entry.isDirectory()) {
				const nested = await walkDir(fullPath)
				results.push(...nested)
				continue
			}

			if (entry.isFile() && !isSystemJunkFile(entry.name)) {
				const fileStat = await stat(fullPath)
				results.push({ path: fullPath, mtimeMs: fileStat.mtimeMs, size: fileStat.size })
			}
		}
	} catch {
		// directory may not exist
	}

	return results
}

export async function computeCacheHash(documentsDir: string, options: object): Promise<string> {
	const hash = createHash('sha256')

	const files = await walkDir(documentsDir)
	files.sort((a, b) => a.path.localeCompare(b.path))

	for (const file of files) {
		hash.update(`${file.path}:${file.mtimeMs}:${file.size}\n`)
	}

	hash.update(JSON.stringify(options))

	return hash.digest('hex')
}

export async function readCachedHash(outDir: string): Promise<string | null> {
	try {
		return await readFile(resolve(outDir, CACHE_FILE_NAME), 'utf-8')
	} catch {
		return null
	}
}

/**
 * A matching hash only proves the inputs are unchanged — not that the outputs
 * are still on disk. An interrupted clean or a manual delete can leave `.cache`
 * behind with the compiled files gone, and honouring that hit would silently
 * skip the compile and break every downstream import. Verify the expected
 * outputs exist before trusting the hash.
 */
export async function cachedOutputsExist(paths: string[]): Promise<boolean> {
	const checks = await Promise.all(
		paths.map(path =>
			stat(path).then(
				() => true,
				() => false
			)
		)
	)

	return checks.every(Boolean)
}

export async function writeCacheHash(outDir: string, hash: string): Promise<void> {
	await writeFile(resolve(outDir, CACHE_FILE_NAME), hash, 'utf-8')
}
