import type { AssetMode, Target } from '../../shared/types/public/compile'

import { readFile, writeFile } from 'node:fs/promises'

/**
 * Post-build placeholders for CLI-compiled wrappers. The wrapper is emitted
 * inside the Vite build (before the per-document asset set is known), so the
 * values are baked in afterwards by replacing these literals in the emitted
 * `index.js`. They live inside JSON string literals, which minifiers preserve.
 */
export const KNOWN_ASSETS_PLACEHOLDER = '__FMT_KNOWN_ASSETS__'
export const ASSET_URLS_PLACEHOLDER = '__FMT_ASSET_URLS__'

interface BakeWrapperAssetConstantsArgs {
	entryPath: string
	known: string[]
	urlMap: Record<string, string> | null
}

/**
 * Replace the wrapper's asset placeholders in an emitted entry file with the
 * document's real values. Quote-style agnostic — minifiers rewrite string
 * literals freely (oxc emits backticks). A file with no placeholders
 * (unplugin builds) is left untouched.
 */
export async function bakeWrapperAssetConstants(args: BakeWrapperAssetConstantsArgs) {
	const { entryPath, known, urlMap } = args

	const source = await readFile(entryPath, 'utf-8').catch(() => null)

	if (source === null) {
		return
	}

	const knownLiteral = JSON.stringify(JSON.stringify(known))
	const urlsLiteral = JSON.stringify(JSON.stringify(urlMap))

	const replaced = source
		.replace(new RegExp(`["'\`]${KNOWN_ASSETS_PLACEHOLDER}["'\`]`, 'g'), knownLiteral)
		.replace(new RegExp(`["'\`]${ASSET_URLS_PLACEHOLDER}["'\`]`, 'g'), urlsLiteral)

	if (replaced !== source) {
		await writeFile(entryPath, replaced, 'utf-8')
	}
}

export interface WrapperFactorySourceArgs {
	mode: AssetMode
	target: Target
	/** Resolved absolute path to the zip module the wrapper imports helpers from (empty in 'none' mode). */
	zipModulePath: string
}

/**
 * The single wrapper implementation shared by CLI compile and the unplugin
 * virtual module. Returns the source for an import line plus a
 * `createRendererWrapper(name, renderer, init)` factory.
 *
 * `init`:
 * - `knownAssets`: the document's known-asset set (zip entries / URL map keys).
 * - `assetUrls`: dynamic mode's `{ knownPath: urlRelativeToModule }` map, or null.
 * - `assetsPath`: static mode's zip location relative to the module, or null.
 * - `assetsUrl`: an already-absolute zip URL (dev-server case), or null.
 *
 * Behaviour by mode:
 * - Both: every render scans the HTML and throws `AssetMismatchError` when it
 *   references assets outside the known set.
 * - static: `getAssetsWebStream()` streams the prebuilt zip (file or fetch).
 * - dynamic: the document's `getAssetsWebStream()` builds the zip at call time
 *   from the URL map, fetching only what that render references.
 *   `setZipOptions()` forwards options to that build (e.g. `remoteAssets`);
 *   it is exposed in static mode too for a uniform surface, but has no effect
 *   there.
 */
export function buildWrapperFactorySource(args: WrapperFactorySourceArgs): string {
	const { mode, target, zipModulePath } = args

	const isDynamic = mode === 'dynamic'
	const isNone = mode === 'none'
	const isNodeTarget = target === 'node'

	// `none` does no asset work, so it imports nothing from @format.dev/zip and never
	// scans the rendered HTML. The other modes import the scanner (static) or the
	// full zip builder (dynamic).
	const zipImports = isDynamic
		? 'zip, scanAssetRefs, scanRemoteRefs, AssetMismatchError'
		: 'scanAssetRefs, scanRemoteRefs, AssetMismatchError'
	const importLine = isNone ? '' : `import { ${zipImports} } from ${JSON.stringify(zipModulePath)};`

	// node can be handed file: URLs (local zip / local mapped assets); web targets only ever fetch.
	const readFileUrl = isNodeTarget
		? `
async function _readFileUrl(url) {
	const { openAsBlob } = await import('node:fs');
	const { fileURLToPath } = await import('node:url');
	const blob = await openAsBlob(fileURLToPath(url));
	return blob;
}
`
		: ''

	const streamFromUrl = isNodeTarget
		? `
async function _streamFromUrl(url, required) {
	try {
		if (url.startsWith('file:')) {
			const blob = await _readFileUrl(url);
			return blob.stream();
		}
		const res = await fetch(url);
		if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
		return res.body;
	} catch (cause) {
		if (required) {
			throw new Error('Assets zip not readable at ' + url + '. Host the zip and call setAssetsUrl(), or recompile.', { cause });
		}
		return undefined;
	}
}
`
		: `
async function _streamFromUrl(url, required) {
	try {
		const res = await fetch(url);
		if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
		return res.body;
	} catch (cause) {
		if (required) {
			throw new Error('Assets zip not reachable at ' + url + '. Host the zip and call setAssetsUrl(), or recompile.', { cause });
		}
		return undefined;
	}
}
`

	const resolveMappedAsset = isNodeTarget
		? `
	const _resolveMappedAsset = async (path) => {
		const rel = assetUrls[path];
		if (!rel) return null;
		const url = new URL(rel, _moduleUrl);
		if (url.protocol === 'file:') {
			try {
				const blob = await _readFileUrl(url.toString());
				return new Uint8Array(await blob.arrayBuffer());
			} catch {
				return null;
			}
		}
		const res = await fetch(url);
		if (!res.ok) return null;
		return new Uint8Array(await res.arrayBuffer());
	};
`
		: `
	const _resolveMappedAsset = async (path) => {
		const rel = assetUrls[path];
		if (!rel) return null;
		const res = await fetch(new URL(rel, _moduleUrl));
		if (!res.ok) return null;
		return new Uint8Array(await res.arrayBuffer());
	};
`

	const documentStream = isDynamic
		? `
		const _docAssetsWebStream = async () => {
			if (_userAssetUrl) return _streamFromUrl(_userAssetUrl, true);
			const bytes = await zip(html, _resolveMappedAsset, _zipOptions);
			return bytes ? new Response(bytes).body : undefined;
		};
`
		: `
		const _docAssetsWebStream = () => _rendererAssetsWebStream();
`

	// static is the only mode with a prebuilt zip to auto-resolve; dynamic and
	// none stream only a user-supplied URL (none never sets one by default).
	const rendererStream =
		isDynamic || isNone
			? `
	async function _rendererAssetsWebStream() {
		if (_userAssetUrl) return _streamFromUrl(_userAssetUrl, true);
		return undefined;
	}
`
			: `
	async function _rendererAssetsWebStream() {
		const url = _userAssetUrl ?? _autoAssetUrl;
		if (!url) return undefined;
		return _streamFromUrl(url, knownAssets.length > 0);
	}
`

	const autoAssetUrl =
		isDynamic || isNone
			? `	const _autoAssetUrl = undefined;`
			: `	const _autoAssetUrl = init.assetsUrl ?? (init.assetsPath && knownAssets.length ? new URL(init.assetsPath, _moduleUrl).toString() : undefined);`

	// static and dynamic validate that the HTML only references known assets;
	// none ships no known set and skips the check entirely.
	const scanBlock = isNone
		? ''
		: `
			const refs = scanAssetRefs(html);
			const missing = refs.filter((ref) => !knownSet.has(ref));
			if (missing.length) {
				throw new AssetMismatchError({ documentName: name, mode: ${JSON.stringify(mode)}, missing, known: knownAssets, remoteRefs: scanRemoteRefs(html) });
			}
`

	// Read the module URL through a variable so webpack leaves the `new URL(...)`
	// calls below as runtime URL construction. Webpack only rewrites
	// `new URL(x, import.meta.url)` into a bundled-asset context when the second
	// argument is literally `import.meta.url`; with a dynamic first argument that
	// context is empty and throws at runtime. Other bundlers are unaffected.
	return `${importLine}
const _moduleUrl = import.meta.url;
${readFileUrl}${streamFromUrl}
function createRendererWrapper(name, renderer, init) {
	const knownAssets = init.knownAssets || [];
	const knownSet = new Set(knownAssets);
	const assetUrls = init.assetUrls || {};
${autoAssetUrl}
	let _userAssetUrl;
	let _zipOptions;
${resolveMappedAsset}
	function _setAssetsUrl(url) {
		if (typeof url !== 'string' || !url.length) throw new Error('Invalid assets URL');
		_userAssetUrl = url;
	}

	function _setZipOptions(options) {
		_zipOptions = options || undefined;
	}

	const _getAssetsUrl = () => _userAssetUrl ?? _autoAssetUrl;
${rendererStream}
	return {
		render: async (data, ...rest) => {
			const html = await renderer.render(data, ...rest);
${scanBlock}${documentStream}
			return {
				html,
				getAssetsWebStream: _docAssetsWebStream,
			};
		},
		getAssetsUrl: _getAssetsUrl,
		setAssetsUrl: _setAssetsUrl,
		setZipOptions: _setZipOptions,
		getAssetsWebStream: _rendererAssetsWebStream,
	};
}
`
}
