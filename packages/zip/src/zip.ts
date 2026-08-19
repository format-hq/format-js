import type { AssetResolver, ZipOptions } from './types'

import { strToU8, unzipSync, zipSync } from 'fflate'
import { parseCssRefs, parseHtmlRefs } from './parse'
import { fetchRemote, isLocalOrigin, isRemoteOrigin, resolveLocalRef, urlToZipName } from './helpers'
import { MissingAssetError, RemoteAssetsDisabledError, UnresolvableRefError } from './errors'
import { MANIFEST_FILE_NAME, ZIP_EPOCH } from './constants'

const utf8 = new TextDecoder('utf-8')

type DeflateLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

interface CssWalkContext {
	resolve: AssetResolver
	assetPaths: Set<string>
	visitedCss: Set<string>
	/** Remote refs found while remoteAssets is disabled — collected to fail loudly after the walk. */
	skippedRemote: Set<string>
	options?: ZipOptions
}

/**
 * Resolve a local ref to its bundle path, or surface it when it names no file to
 * bundle. A bare `#id` fragment is a same-document reference (an SVG paint
 * server, clip-path, mask, or filter), so it returns null and is skipped
 * silently. Anything else that resolves to nothing is a broken reference — an
 * empty `src`/`href`/`url("")`, or one like `/` or `.` that points at the bundle
 * root — so it is reported rather than dropped: a warning when `skipMissing` is
 * set, an {@link UnresolvableRefError} otherwise.
 */
function resolveLocalOrReport(ref: string, baseRel: string, options?: ZipOptions): string | null {
	const local = resolveLocalRef(ref, baseRel)
	if (local) {
		return local
	}

	if (ref.startsWith('#')) {
		return null
	}

	if (options?.skipMissing) {
		console.warn(`[zip] Unresolvable asset reference, skipping: ${JSON.stringify(ref)}`)
		return null
	}

	throw new UnresolvableRefError(ref)
}

/**
 * Read a local CSS file through the resolver, record it, then walk its contents.
 */
async function processCssFile(cssRel: string, context: CssWalkContext) {
	if (context.visitedCss.has(cssRel)) {
		return
	}
	context.visitedCss.add(cssRel)

	const bytes = await context.resolve(cssRel)

	if (!bytes) {
		console.warn(`[zip] CSS file not found, skipping: ${cssRel}`)
		return
	}

	context.assetPaths.add(cssRel)

	await processCssContent(utf8.decode(bytes), cssRel, context)
}

/**
 * Fetch a remote CSS file, record its URL, then walk its contents.
 */
async function processRemoteCssFile(remoteUrl: string, context: CssWalkContext) {
	if (context.visitedCss.has(remoteUrl)) {
		return
	}
	context.visitedCss.add(remoteUrl)

	try {
		const { bytes } = await fetchRemote({
			url: remoteUrl,
			headers: context.options?.remoteAssets?.headers,
			timeoutMs: context.options?.remoteAssets?.timeoutMs
		})

		context.assetPaths.add(remoteUrl)

		await processCssContent(utf8.decode(bytes), '.', context, remoteUrl)
	} catch (error) {
		if (context.options?.skipMissing) {
			console.log(`[zip] Could not fetch remote CSS "${remoteUrl}". Continuing as skipMissing is set.`, error)
			return
		}

		throw error
	}
}

/**
 * Walk one CSS string: record every local/remote url() target and follow every
 * @import. `baseRel` is the referring file's path so relative refs resolve
 * correctly; `remoteBaseUrl` switches resolution into remote-URL space.
 */
async function processCssContent(cssText: string, baseRel: string, context: CssWalkContext, remoteBaseUrl?: string) {
	const { assetPaths, options } = context
	const allowRemote = options?.remoteAssets?.enabled === true
	const { urls, imports } = parseCssRefs(cssText)
	const importPromises: Promise<void>[] = []

	for (const importPath of imports) {
		if (remoteBaseUrl) {
			if (!allowRemote) {
				continue
			}

			try {
				const url = new URL(importPath, remoteBaseUrl).toString()
				if (isRemoteOrigin(url)) {
					importPromises.push(processRemoteCssFile(url, context))
				}
			} catch (error) {
				console.warn(`[zip] Error parsing remote CSS @import (base: ${remoteBaseUrl}, path: ${importPath})`, error)
			}

			continue
		}

		if (isLocalOrigin(importPath)) {
			const local = resolveLocalOrReport(importPath, baseRel, options)
			if (local) {
				importPromises.push(processCssFile(local, context))
			}
			continue
		}

		if (isRemoteOrigin(importPath)) {
			if (allowRemote) {
				importPromises.push(processRemoteCssFile(new URL(importPath).toString(), context))
				continue
			}

			context.skippedRemote.add(importPath)
		}
	}

	for (const ref of urls) {
		if (remoteBaseUrl) {
			if (!allowRemote) {
				continue
			}

			try {
				const url = new URL(ref, remoteBaseUrl).toString()
				if (isRemoteOrigin(url)) {
					assetPaths.add(url)
				}
			} catch (error) {
				console.warn(`[zip] Error parsing remote CSS url() (base: ${remoteBaseUrl}, path: ${ref})`, error)
			}

			continue
		}

		if (isLocalOrigin(ref)) {
			const local = resolveLocalOrReport(ref, baseRel, options)
			if (local) {
				assetPaths.add(local)
			}
			continue
		}

		if (isRemoteOrigin(ref)) {
			if (allowRemote) {
				assetPaths.add(new URL(ref).toString())
				continue
			}

			context.skippedRemote.add(ref)
		}
	}

	await Promise.all(importPromises)
}

/**
 * Collect every asset path referenced by `html`: `<img src>`, inline-SVG
 * `<image>`/`<use>` hrefs, `<link rel=stylesheet>` (following nested @import
 * chains via the resolver), and `url(...)` in `<style>` blocks and style
 * attributes. Local refs come back as bundle-root relative paths; remote URLs
 * are included only when `options.remoteAssets.enabled` is set.
 *
 * @throws {RemoteAssetsDisabledError} when remote refs are found and
 *   `remoteAssets` is not enabled — a zip without them produces a broken PDF.
 */
export async function collectAssetPaths(
	html: string,
	resolve: AssetResolver,
	options?: ZipOptions
): Promise<Set<string>> {
	const { imgSrcs, svgHrefs, linkHrefs, inlineCss } = parseHtmlRefs(html)
	const assetPaths = new Set<string>()
	const allowRemote = options?.remoteAssets?.enabled === true
	const context: CssWalkContext = { resolve, assetPaths, visitedCss: new Set(), skippedRemote: new Set(), options }

	const addElementRef = (ref: string) => {
		if (isLocalOrigin(ref)) {
			const local = resolveLocalOrReport(ref, '.', options)
			if (local) {
				assetPaths.add(local)
			}
			return
		}

		if (!isRemoteOrigin(ref)) {
			return
		}

		if (allowRemote) {
			assetPaths.add(ref)
			return
		}

		context.skippedRemote.add(ref)
	}

	for (const src of imgSrcs) {
		addElementRef(src)
	}

	for (const href of svgHrefs) {
		addElementRef(href)
	}

	const handleError = (error: unknown) => {
		if (options?.skipMissing) {
			console.warn('[zip] Error processing CSS content. Continuing as skipMissing is set.')
			return
		}

		throw error
	}

	const cssPromises: Promise<void>[] = []

	for (const href of linkHrefs) {
		if (isLocalOrigin(href)) {
			const local = resolveLocalOrReport(href, '.', options)
			if (local) {
				cssPromises.push(processCssFile(local, context).catch(handleError))
			}
			continue
		}

		if (!isRemoteOrigin(href)) {
			continue
		}

		if (allowRemote) {
			cssPromises.push(processRemoteCssFile(href, context).catch(handleError))
			continue
		}

		context.skippedRemote.add(href)
	}

	for (const cssText of inlineCss) {
		cssPromises.push(processCssContent(cssText, '.', context).catch(handleError))
	}

	await Promise.all(cssPromises)

	if (!allowRemote && context.skippedRemote.size > 0) {
		throw new RemoteAssetsDisabledError([...context.skippedRemote].sort())
	}

	return assetPaths
}

/**
 * Resolve every collected asset to its bytes, keyed by zip entry name. Local
 * paths go through the resolver; remote URLs (internal) are fetched and renamed
 * deterministically, with a manifest mapping original URLs to entries.
 */
async function buildFileMap(
	assetPaths: Set<string>,
	resolve: AssetResolver,
	options?: ZipOptions
): Promise<Record<string, Uint8Array>> {
	const files: Record<string, Uint8Array> = {}
	const allowRemote = options?.remoteAssets?.enabled ?? false

	const localPaths = [...assetPaths].filter(isLocalOrigin)
	const localEntries = await Promise.all(localPaths.map(async name => ({ name, bytes: await resolve(name) })))

	for (const { name, bytes } of localEntries) {
		if (bytes) {
			files[name] = bytes
			continue
		}

		if (options?.skipMissing) {
			console.warn(`[zip] Missing local asset, skipping: ${name}`)
			continue
		}

		throw new MissingAssetError(name)
	}

	if (!allowRemote) {
		return files
	}

	const remotePaths = [...assetPaths].filter(isRemoteOrigin)
	const manifest: Record<string, string> = {}

	const remoteEntries = await Promise.all(
		remotePaths.map(async url => {
			try {
				const { bytes, mimeType } = await fetchRemote({
					url,
					headers: options?.remoteAssets?.headers,
					timeoutMs: options?.remoteAssets?.timeoutMs
				})
				return { url, name: urlToZipName(url, mimeType), bytes }
			} catch (error) {
				if (options?.skipMissing) {
					console.warn(`[zip] Missing remote asset, skipping: ${url}`)
					return null
				}

				console.error(`[zip] Failed to fetch external asset: ${url}`, error)
				throw new MissingAssetError(url)
			}
		})
	)

	for (const entry of remoteEntries) {
		if (!entry) {
			continue
		}

		manifest[entry.url] = entry.name
		files[entry.name] = entry.bytes
	}

	files[MANIFEST_FILE_NAME] = strToU8(JSON.stringify({ remoteAssets: manifest }))

	return files
}

/** Entry names of an existing archive. A static-mode zip's entries are the document's known-asset set. */
export function listZipEntries(bytes: Uint8Array): string[] {
	return Object.keys(unzipSync(bytes)).sort()
}

interface MergeRemoteAssetsArgs {
	html: string
	/** Existing archive to merge into, or undefined to start fresh. */
	zip?: Uint8Array
	options?: ZipOptions
}

/**
 * Fetch every remote (http/https) asset `html` references and merge it into an
 * existing archive, alongside a manifest mapping each URL to its zip entry.
 * Remote stylesheets are walked too, so a remote CSS file's fonts and images
 * come along with it. Local CSS already inside the archive is also walked for
 * remote references.
 *
 * URLs already present in the archive's manifest are not fetched again, so
 * calling this repeatedly over the same archive is idempotent and cheap.
 *
 * @returns the merged archive bytes; the input `zip` unchanged when `html`
 *   references nothing remote that isn't already bundled; or `undefined` when
 *   there is no input archive and nothing remote to fetch.
 * @throws {RemoteAssetFetchError} when the network itself is unreachable.
 */
export async function mergeRemoteAssets(args: MergeRemoteAssetsArgs): Promise<Uint8Array | undefined> {
	const { html, zip: existingZip, options } = args

	const entries: Record<string, Uint8Array> = existingZip ? unzipSync(existingZip) : {}

	const manifest: Record<string, string> = {}
	const manifestEntry = entries[MANIFEST_FILE_NAME]

	if (manifestEntry) {
		try {
			const parsed = JSON.parse(utf8.decode(manifestEntry)) as { remoteAssets?: Record<string, string> }
			Object.assign(manifest, parsed.remoteAssets)
		} catch {
			console.warn(`[zip] Could not parse existing ${MANIFEST_FILE_NAME}, rebuilding the remote manifest`)
		}
	}

	const resolveFromZip: AssetResolver = async relPath => entries[relPath] ?? null

	const remoteOptions: ZipOptions = {
		...options,
		remoteAssets: { ...options?.remoteAssets, enabled: true }
	}

	const assetPaths = await collectAssetPaths(html, resolveFromZip, remoteOptions)
	const remoteUrls = [...assetPaths].filter(isRemoteOrigin).filter(url => !(url in manifest))

	if (remoteUrls.length === 0) {
		return existingZip
	}

	const fetched = await Promise.all(
		remoteUrls.map(async url => {
			const { bytes, mimeType } = await fetchRemote({
				url,
				headers: options?.remoteAssets?.headers,
				timeoutMs: options?.remoteAssets?.timeoutMs
			})
			return { url, name: urlToZipName(url, mimeType), bytes }
		})
	)

	for (const { url, name, bytes } of fetched) {
		manifest[url] = name
		entries[name] = bytes
	}

	entries[MANIFEST_FILE_NAME] = strToU8(JSON.stringify({ remoteAssets: manifest }))

	return zipSync(entries, { level: deflateLevel(options), mtime: ZIP_EPOCH })
}

export function deflateLevel(options?: ZipOptions): DeflateLevel {
	const level = options?.zlib?.level
	const isValidLevel = typeof level === 'number' && level >= 0 && level <= 9
	return (isValidLevel ? level : 6) as DeflateLevel
}

/**
 * Build a ZIP archive of every asset `html` references, resolving bytes through
 * `resolve`. Runs in Node, workers, and browsers (node-html-parser scans the
 * HTML).
 *
 * @returns the archive bytes, or `undefined` when `html` references no assets.
 * @throws {MissingAssetError} when `skipMissing` is unset and the resolver
 *   returns `null` for a referenced asset.
 * @throws {UnresolvableRefError} when `skipMissing` is unset and a local ref
 *   names no file — an empty `src`/`href`/`url("")`, or one like `/` or `.` that
 *   resolves to the bundle root.
 * @throws {RemoteAssetsDisabledError} when `html` references remote (http/https)
 *   assets and `remoteAssets` is not enabled — they would be missing from the
 *   archive and the PDF.
 */
export async function zip(html: string, resolve: AssetResolver, options?: ZipOptions): Promise<Uint8Array | undefined> {
	const assetPaths = await collectAssetPaths(html, resolve, options)

	if (assetPaths.size === 0) {
		return undefined
	}

	const files = await buildFileMap(assetPaths, resolve, options)

	return zipSync(files, { level: deflateLevel(options), mtime: ZIP_EPOCH })
}
