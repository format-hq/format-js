import type { FormatConfig } from '../../shared/types'

import { basename, dirname, join, relative, resolve } from 'node:path'
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { zipDir, isSystemJunkFile } from '@format.dev/zip'
import { getSharedAssetsDir } from '../project/paths'
import { checkDir } from '../utils'

/** Reserved co-location folder: `documents/<name>/assets/` travels with the document. */
export const DOCUMENT_ASSETS_DIR_NAME = 'assets'

/**
 * Everything that can contribute files to one document's asset set:
 * the shared assets dir, the document's own `./assets/` folder, and the
 * Vite-emitted output (hashed images and fonts). The shared assets dir and the
 * Vite-emitted output both live in the bundle's shared `shared-assets/` dir;
 * the document's `./assets/` lands under `<doc>/assets/`. On filename clash the
 * per-document folder wins.
 */
export interface DocumentAssetSources {
	sharedAssetsDir: string | null
	documentAssetsDir: string | null
	/** The shared Vite-emitted dir (hashed images + fonts), or null when absent. */
	emittedDir: string | null
}

interface ResolveSourcesArgs {
	/** The document's entry file path — its `assets/` sibling is the per-doc folder. */
	entryFilePath: string
	config: FormatConfig
	outDir: string
	sharedAssetsOutDirName: string
}

export async function resolveDocumentAssetSources(args: ResolveSourcesArgs): Promise<DocumentAssetSources> {
	const { entryFilePath, config, outDir, sharedAssetsOutDirName } = args

	const sharedAssetsDir = getSharedAssetsDir(config)
	const documentAssetsDir = join(dirname(entryFilePath), DOCUMENT_ASSETS_DIR_NAME)
	const emittedDir = resolve(outDir, sharedAssetsOutDirName)

	const [sharedOk, perDocOk, emittedOk] = await Promise.all([
		checkDir(sharedAssetsDir),
		checkDir(documentAssetsDir),
		checkDir(emittedDir)
	])

	return {
		sharedAssetsDir: sharedOk.isDirectory ? sharedAssetsDir : null,
		documentAssetsDir: perDocOk.isDirectory ? documentAssetsDir : null,
		emittedDir: emittedOk.isDirectory ? emittedDir : null
	}
}

/**
 * Recursively list a directory's files as '/'-separated paths relative to it.
 *
 * Walks by hand with `stat` (not `readdir({ recursive: true })`) so it descends
 * through symlinked directories. Asset roots are often wired up with symlinks —
 * a shared `assets/` dir linked into a project, for example — and those files
 * must still be discovered and shipped.
 */
async function listFiles(dir: string): Promise<string[]> {
	const walk = async (current: string): Promise<string[]> => {
		const entries = await readdir(current, { withFileTypes: true }).catch(() => [])

		const nested = await Promise.all(
			entries.map(async entry => {
				const entryPath = join(current, entry.name)
				const stats = await stat(entryPath).catch(() => null)

				if (!stats) {
					return []
				}

				if (stats.isDirectory()) {
					return walk(entryPath)
				}

				const isShippableFile = stats.isFile() && !isSystemJunkFile(entry.name)

				return isShippableFile ? [entryPath] : []
			})
		)

		return nested.flat()
	}

	const files = await walk(dir)

	return files.map(file => relative(dir, file).split('\\').join('/')).sort()
}

/**
 * Copy the document-scoped sources (shared assets dir, then the per-document
 * `./assets/` folder on top — last write wins) into `destDir`.
 */
async function overlayDocumentSources(sources: DocumentAssetSources, destDir: string) {
	await mkdir(destDir, { recursive: true })

	if (sources.sharedAssetsDir) {
		await cp(sources.sharedAssetsDir, destDir, { recursive: true, force: true, dereference: true })
	}

	if (sources.documentAssetsDir) {
		await cp(sources.documentAssetsDir, destDir, { recursive: true, force: true, dereference: true })
	}
}

export interface StaticAssetsResult {
	/** Zip entry names — the document's known-asset set. Empty when no assets. */
	known: string[]
	/** The merged archive, or undefined when the document has no assets. */
	zip: Uint8Array | undefined
}

/**
 * Build one document's merged `assets.zip` (static mode): the full merged set,
 * with no filtering by rendered HTML — any variant renders from the same zip.
 *
 * Standalone by design: callable without emitting any JS wrapper, so HTML
 * output (`format compile --output=html`) can reuse the same artefact.
 */
export async function buildDocumentStaticAssets(
	sources: DocumentAssetSources,
	stagingDir: string
): Promise<StaticAssetsResult> {
	await rm(stagingDir, { recursive: true, force: true })
	await overlayDocumentSources(sources, stagingDir)

	if (sources.emittedDir) {
		const emittedName = sources.emittedDir.split('\\').join('/').split('/').pop()!
		await cp(sources.emittedDir, join(stagingDir, emittedName), { recursive: true, force: true, dereference: true })
	}

	try {
		const known = await listFiles(stagingDir)
		const zip = await zipDir(stagingDir)

		return { known, zip }
	} finally {
		await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
	}
}

export interface CompiledDynamicAssetEntry {
	/** The known-asset path (URL map key) this file backs. */
	knownPath: string
	/** Absolute path of the file in the compiled outDir. */
	sourcePath: string
	/** '/'-separated path for emission into a consumer bundle, mirroring the outDir layout. */
	emitPath: string
}

/**
 * Turn a compiled document's dynamic-mode URL map into per-file emit entries,
 * for consumers that re-host the assets (the unplugin, Next.js). The map value
 * is each file's location relative to the document's `index.js`, so it already
 * encodes the on-disk path — no need to re-scan the output or re-infer which
 * dir a file came from. `<doc>/assets/x` → emitted under the document; a
 * `../shared-assets/x` value → emitted under the shared dir, shared across docs.
 */
export function dynamicAssetEmitEntries(args: {
	outDir: string
	documentName: string
	urlMap: Record<string, string>
}): CompiledDynamicAssetEntry[] {
	const { outDir, documentName, urlMap } = args

	const documentOutDir = join(outDir, documentName)

	return Object.entries(urlMap).map(([knownPath, url]) => {
		const sourcePath = resolve(documentOutDir, url)
		const emitPath = relative(outDir, sourcePath).split('\\').join('/')

		return { knownPath, sourcePath, emitPath }
	})
}

export interface DynamicAssetsResult {
	/** The document's known-asset set (map keys). Empty when no assets. */
	known: string[]
	/**
	 * Known-asset path → URL relative to the document's `index.js`. The wrapper
	 * resolves each against `import.meta.url` at render time.
	 */
	urlMap: Record<string, string>
}

/**
 * Materialise the dynamic-mode shared asset layout once per build and return the
 * shared portion of every document's URL map (relative to a document dir). Both
 * the `sharedAssetsDir` contents and the Vite-emitted output (hashed images +
 * fonts) live in the bundle's `shared-assets/` dir, so they are shared across
 * documents and never duplicated.
 *
 * Their map keys differ by how the rendered HTML references them: author files
 * from `sharedAssetsDir` are referenced by their bare path (e.g. `cube.svg`),
 * while Vite rewrites its emitted references to include the dir (e.g.
 * `shared-assets/chart-abc.png`). We snapshot the Vite-emitted files *before*
 * copying `sharedAssetsDir` in, so the two are never confused.
 */
export async function materialiseSharedDynamicAssets(args: {
	config: FormatConfig
	outDir: string
	sharedAssetsOutDirName: string
}): Promise<Record<string, string>> {
	const { config, outDir, sharedAssetsOutDirName } = args

	const sharedAssetsOutDir = resolve(outDir, sharedAssetsOutDirName)
	const sharedName = basename(sharedAssetsOutDir)

	const sharedAssetsSource = getSharedAssetsDir(config)
	const [sharedSourceOk, emittedOk] = await Promise.all([checkDir(sharedAssetsSource), checkDir(sharedAssetsOutDir)])

	const sharedAssetsDir = sharedSourceOk.isDirectory ? sharedAssetsSource : null
	const emittedDir = emittedOk.isDirectory ? sharedAssetsOutDir : null

	const urlMap: Record<string, string> = {}

	// Vite emits straight into the shared dir, so its current contents are the
	// emitted files — snapshot them before the sharedAssetsDir copy lands on top.
	const emittedRels = emittedDir ? await listFiles(emittedDir) : []

	for (const rel of emittedRels) {
		urlMap[`${sharedName}/${rel}`] = `../${sharedName}/${rel}`
	}

	if (sharedAssetsDir) {
		await mkdir(sharedAssetsOutDir, { recursive: true })
		await cp(sharedAssetsDir, sharedAssetsOutDir, { recursive: true, force: true, dereference: true })

		for (const rel of await listFiles(sharedAssetsDir)) {
			urlMap[rel] = `../${sharedName}/${rel}`
		}
	}

	return urlMap
}

/**
 * Materialise one document's own runtime asset layout (dynamic mode) and return
 * its full URL map. The document's `./assets/` folder is copied to
 * `<documentOutDir>/assets/**` (bare keys, document-local urls); the shared
 * entries are merged in on top with the per-document folder winning on clash.
 */
export async function buildDocumentDynamicAssets(args: {
	documentAssetsDir: string | null
	documentOutDir: string
	sharedUrlMap: Record<string, string>
}): Promise<DynamicAssetsResult> {
	const { documentAssetsDir, documentOutDir, sharedUrlMap } = args

	const runtimeAssetsDir = join(documentOutDir, DOCUMENT_ASSETS_DIR_NAME)

	await rm(runtimeAssetsDir, { recursive: true, force: true })

	const urlMap: Record<string, string> = { ...sharedUrlMap }

	if (documentAssetsDir) {
		await mkdir(runtimeAssetsDir, { recursive: true })
		await cp(documentAssetsDir, runtimeAssetsDir, { recursive: true, force: true, dereference: true })

		for (const rel of await listFiles(runtimeAssetsDir)) {
			urlMap[rel] = `./${DOCUMENT_ASSETS_DIR_NAME}/${rel}`
		}
	}

	return { known: Object.keys(urlMap).sort(), urlMap }
}
