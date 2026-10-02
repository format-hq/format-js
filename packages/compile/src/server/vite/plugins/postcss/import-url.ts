/**
 * A postcss plugin that inlines remote css imports.
 */

import postcss from 'postcss'
import type { Plugin, AtRule, Root, Result } from 'postcss'

import { http } from '../../../../shared/http'
import { CompileError } from '../../../errors'

const { list: postcssList } = postcss

export interface ImportUrlOptions {
	recursive?: boolean
	resolveUrls?: boolean
	userAgent?: string | null
	dataUrls?: boolean
}

interface RequestResult {
	body: string
	parent: string
}

interface InlineImportsArgs {
	root: Root
	ctx: { result: Result }
	parentUrl?: string
}

interface ResolveRelativeArgs {
	target: string
	baseUrl?: string
}

interface AbsolutizeUrlArgs {
	cssUrlValue: string
	importedFromUrl: string
}

interface FetchCssArgs {
	absoluteUrl: string
	options: Required<ImportUrlOptions>
	ctx: { result: Result }
	atRule: AtRule
}

const DEFAULT_OPTIONS: Required<ImportUrlOptions> = {
	recursive: true,
	resolveUrls: false,
	userAgent: null,
	dataUrls: false
}

const SPACE = postcssList.space
const URL_FUNCTION_REGEX = /url\(["']?.+?['"]?\)/g
const FETCH_CACHE = new Map<string, Promise<RequestResult>>()

export function postcssImportUrl(options?: ImportUrlOptions): Plugin {
	const resolvedOptions: Required<ImportUrlOptions> = { ...DEFAULT_OPTIONS, ...(options ?? {}) }

	async function inlineImports({ root, ctx, parentUrl }: InlineImportsArgs): Promise<void> {
		const effectiveParentUrl: string | undefined = parentUrl || root.source?.input?.file
		const pendingImports: Array<Promise<void>> = []

		root.walkAtRules('import', (atRule: AtRule) => {
			const importParams = SPACE(atRule.params)
			const importTargetRaw = extractUrlFromImport(importParams[0])

			let normalizedTarget = importTargetRaw

			// Handle protocol-less (//) URLs and just use https
			if (normalizedTarget.startsWith('//')) {
				const httpsUrl = `https:${normalizedTarget}`
				atRule.warn(ctx.result, `Protocol-less @import '${normalizedTarget}' normalized to '${httpsUrl}'.`)
				normalizedTarget = httpsUrl
			}

			// Resolve against parent (handles relative paths AND protocol-less)
			if (effectiveParentUrl) {
				normalizedTarget = resolveRelative({ target: normalizedTarget, baseUrl: effectiveParentUrl })
			}

			if (!isHttpUrl(normalizedTarget)) {
				return
			}

			pendingImports.push(
				fetchCss({ absoluteUrl: normalizedTarget, options: resolvedOptions, ctx, atRule }).then(
					async (response: RequestResult) => {
						let importedRoot: Root | AtRule = postcss.parse(response.body)

						const hasLayerQualifier = importParams.some(p => p.includes('layer'))
						const hasSupportsQualifier = importParams.some(p => p.includes('supports'))

						const mediaStartIndex = hasLayerQualifier ? (hasSupportsQualifier ? 3 : 2) : 1
						const mediaQuery = importParams.slice(mediaStartIndex).join(' ')

						if (mediaQuery) {
							const mediaWrapper = postcss.atRule({ name: 'media', params: mediaQuery, source: atRule.source })
							mediaWrapper.append(importedRoot)
							importedRoot = mediaWrapper
						} else {
							importedRoot.source = atRule.source
						}

						if (hasSupportsQualifier) {
							const supportsToken = importParams.find(p => p.includes('supports')) || ''
							const open = supportsToken.indexOf('(')
							const close = supportsToken.lastIndexOf(')')
							const supportsQuery = open >= 0 && close > open ? supportsToken.slice(open + 1, close) : ''

							const supportsWrapper = postcss.atRule({
								name: 'supports',
								params: supportsQuery ? `(${supportsQuery})` : '',
								source: atRule.source
							})

							supportsWrapper.append(importedRoot)
							importedRoot = supportsWrapper
						} else {
							importedRoot.source = atRule.source
						}

						if (hasLayerQualifier) {
							const layerToken = importParams.find(p => p.includes('layer')) || ''
							const open = layerToken.indexOf('(')
							const close = layerToken.lastIndexOf(')')
							const layerName = open >= 0 && close > open ? layerToken.slice(open + 1, close) : ''

							const layerWrapper = postcss.atRule({
								name: 'layer',
								params: layerName,
								source: importedRoot.source
							})

							layerWrapper.append(importedRoot)
							importedRoot = layerWrapper
						}

						// Optional: Resolve any url(...) references to absolute URLs
						if (resolvedOptions.resolveUrls) {
							importedRoot = importedRoot.replaceValues(URL_FUNCTION_REGEX, { fast: 'url(' }, (val: string) =>
								absolutizeUrlFunction({ cssUrlValue: val, importedFromUrl: normalizedTarget })
							)
						}

						// Optional: If there are any @imports in the imported CSS, recursively import them
						if (resolvedOptions.recursive && 'toResult' in importedRoot) {
							await inlineImports({ root: importedRoot, ctx, parentUrl: response.parent })
						}

						// Optional: Convert the imported CSS to a base64-encoded data URL
						if (resolvedOptions.dataUrls) {
							const base64 = Buffer.from(importedRoot.toString()).toString('base64')
							atRule.params = `url(data:text/css;base64,${base64})`
						} else {
							atRule.replaceWith(importedRoot)
						}
					}
				)
			)
		})

		await Promise.all(pendingImports)
	}

	return {
		postcssPlugin: 'postcss-import-url',
		Once: (root: Root, helpers: { result: Result }) => inlineImports({ root, ctx: helpers })
	}
}

function extractUrlFromImport(param: string): string {
	let value = param
	if (value.startsWith('url')) value = value.slice(3)
	return value.trim().replace(/^['"(]+|['")]+$/g, '')
}

function isHttpUrl(candidate: string): boolean {
	try {
		const u = new URL(candidate)
		return u.protocol === 'http:' || u.protocol === 'https:'
	} catch {
		return false
	}
}

function resolveRelative({ target, baseUrl }: ResolveRelativeArgs): string {
	if (isHttpUrl(target)) return target
	if (!baseUrl || !isHttpUrl(baseUrl)) return target

	try {
		return new URL(target, baseUrl).href
	} catch {
		return target
	}
}

function absolutizeUrlFunction({ cssUrlValue, importedFromUrl }: AbsolutizeUrlArgs): string {
	const cleaned = extractUrlFromImport(cssUrlValue)
	const absolute = resolveRelative({ target: cleaned, baseUrl: importedFromUrl })
	return `url("${absolute}")`
}

async function fetchCss({ absoluteUrl, options, ctx, atRule }: FetchCssArgs): Promise<RequestResult> {
	const cached = FETCH_CACHE.get(absoluteUrl)
	if (cached) return cached

	const headers: Record<string, string> = {
		connection: 'keep-alive',
		'user-agent': options.userAgent || 'Mozilla/5.0 AppleWebKit/538.0 Chrome/88.0.0.0 Safari/538',
		accept: 'text/css,*/*;q=0.1'
	}

	const promise = (async () => {
		const { data, error } = await http<string>(absoluteUrl, {
			headers,
			responseType: 'text'
		})

		if (error) {
			throw new CompileError(`Failed to fetch ${absoluteUrl}: ${error}`)
		}

		if (!data) {
			throw new CompileError(`Failed to fetch ${absoluteUrl}: No data returned`)
		}

		return { body: data, parent: absoluteUrl }
	})()

	FETCH_CACHE.set(absoluteUrl, promise)
	return promise
}
