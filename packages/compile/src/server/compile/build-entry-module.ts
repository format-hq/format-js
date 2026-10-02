import type { AssetMode, Target } from '../../shared/types/public/compile'

import { buildWrapperFactorySource, KNOWN_ASSETS_PLACEHOLDER, ASSET_URLS_PLACEHOLDER } from './wrapper-source'

export type BuildDocument = {
	name: string
	entryFilePath: string
	schemaPath?: string
	exportName: string
}

export type BuildDocumentEntryOptions = {
	target: Target
	source: 'cli' | 'unplugin'
	assetMode: AssetMode
	/** Resolved absolute path to the zip module the wrapper imports helpers from. */
	zipModulePath: string
}

export function buildDocumentEntryModule(
	document: BuildDocument,
	createRendererId: string,
	opts: BuildDocumentEntryOptions
): string {
	const { target, source, assetMode, zipModulePath } = opts

	const imports: string[] = [
		`import { createRenderer } from ${JSON.stringify(createRendererId)};`,
		`import { getEntryStyles } from "virtual:styles";`,
		`import Component from ${JSON.stringify(document.entryFilePath)};`
	]

	if (document.schemaPath) {
		imports.push(`import schema from ${JSON.stringify(document.schemaPath)};`)
	} else {
		imports.push('const schema = undefined;')
	}

	const styles = `const styles = getEntryStyles(${JSON.stringify(document.name)});`

	// For unplugin builds the assets wrapper is applied by the virtual module.
	// For CLI builds we add it here so the compiled output exposes the full renderer API.
	if (source === 'unplugin') {
		const renderer = `const ${document.exportName} = createRenderer({ Component, schema, styles });`
		const namedExports = `export { ${document.exportName} };`
		const defaultExport = `export default { ${document.exportName} };`
		return [imports.join('\n'), styles, renderer, namedExports, defaultExport].join('\n\n')
	}

	// CLI build: wrap the renderer with the shared asset wrapper. The known-asset
	// set and (dynamic mode) URL map aren't known until after the build, so they
	// are emitted as JSON-string placeholders and baked in post-build.
	const factory = buildWrapperFactorySource({ mode: assetMode, target, zipModulePath })

	const baseRenderer = `const _renderer = createRenderer({ Component, schema, styles });`

	// Only the node target auto-initialises the zip location: browser and
	// worker bundles return undefined from getAssetsUrl() until setAssetsUrl()
	// is called (the documented FormatAssetConfig contract).
	const autoInitAssetsPath = assetMode === 'static' && target === 'node'

	const init = [
		`{`,
		`  knownAssets: JSON.parse(${JSON.stringify(KNOWN_ASSETS_PLACEHOLDER)}),`,
		`  assetUrls: JSON.parse(${JSON.stringify(ASSET_URLS_PLACEHOLDER)}),`,
		`  assetsPath: ${autoInitAssetsPath ? `'./assets.zip'` : 'null'},`,
		`}`
	].join('\n')

	const wrappedRenderer = `const ${document.exportName} = createRendererWrapper(${JSON.stringify(
		document.name
	)}, _renderer, ${init});`

	const namedExports = `export { ${document.exportName} };`
	const defaultExport = `export default { ${document.exportName} };`

	return [imports.join('\n'), styles, baseRenderer, factory, wrappedRenderer, namedExports, defaultExport].join('\n\n')
}
