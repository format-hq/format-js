import type { FormatConfig } from '../../shared/types/public/config'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getDocumentDataFile } from '../project/documents'
import { DEFAULT_VARIANT } from '../../shared/constants'
import { BUNDLE_ENTRY_POINT_FILE_NAME } from './constants'
import { getDocumentExportName } from '@format.dev/cli/scaffold'

interface GetRendererArgs {
	dir: string
	documentName: string
	variant?: string
	config: FormatConfig
	bundle?: Record<string, any>
}

export async function loadRendererBundle(dir: string, documentName?: string): Promise<Record<string, any>> {
	const entryPath =
		documentName != null
			? resolve(dir, documentName, BUNDLE_ENTRY_POINT_FILE_NAME)
			: resolve(dir, BUNDLE_ENTRY_POINT_FILE_NAME)

	// Need a unique URL; Node ESM caches by URL and ignores hash fragments.
	const url = new URL(pathToFileURL(entryPath).href)
	const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2)}`
	url.search = `?t=${cacheBuster}`

	return import(url.href)
}

function resolveRenderer(bundle: Record<string, any>, documentName: string) {
	const exportName = getDocumentExportName(documentName)

	const renderer = bundle?.[exportName] ?? bundle?.default?.[exportName] ?? bundle?.default?.default?.[exportName]

	if (!renderer) {
		throw new Error(`Renderer export "${exportName}" not found for document "${documentName}".`)
	}

	return renderer
}

export async function getRenderer(args: GetRendererArgs) {
	const { dir, documentName, config, variant = DEFAULT_VARIANT, bundle } = args

	const rendererBundle = bundle ?? (await loadRendererBundle(dir, documentName))
	const pdfRenderer = resolveRenderer(rendererBundle, documentName)
	const data = await getDocumentDataFile(documentName, variant, config)

	return { pdfRenderer, data }
}
