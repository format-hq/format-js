import type { AssetResolver } from './types'

/**
 * Web-standard resolver that maps asset paths to URLs and fetches them. This is
 * the dynamic-mode runtime resolver: the compiled wrapper bakes in the
 * `{ relPath: url }` map and fetches only the bytes a given render references.
 * Returns `null` for unmapped paths. Portable — uses only `fetch`.
 */
export function urlResolver(urlMap: Record<string, string>): AssetResolver {
	return async relPath => {
		const url = urlMap[relPath]

		if (!url) {
			return null
		}

		const res = await fetch(url)

		if (!res.ok) {
			throw new Error(`Failed to fetch asset "${relPath}" from ${url}: HTTP ${res.status}`)
		}

		return new Uint8Array(await res.arrayBuffer())
	}
}
