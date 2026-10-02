import { FORBID_TAGS } from '@format.dev/utils'

import { unified } from 'unified'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import {
	buildObservedSchema,
	parseHtmlFragment,
	stripDangerousUrls,
	stringifyHtmlFragment,
	type HastNode
} from './sanitize/shared'

// What this sanitizer strips vs keeps is kept as internal architecture
// documentation.

function isLocalHref(href: string) {
	// Relative URLs are always "local".
	// We also treat protocol-relative URLs (//example.com) as remote.
	// Everything else with a scheme (http:, https:, data:, etc) is remote.
	return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) && !href.startsWith('//')
}

function isForbiddenUrl(value: string) {
	const normalized = value.trim().toLowerCase()
	return normalized.startsWith('javascript:')
}

function isStylesheetLink(properties: Record<string, unknown>): { href: string; ok: boolean } {
	const rel = properties.rel
	const href = typeof properties.href === 'string' ? properties.href : ''

	const relValues = Array.isArray(rel) ? rel : typeof rel === 'string' ? rel.split(/\s+/) : []
	const isStylesheet = relValues.some(v => String(v).toLowerCase() === 'stylesheet')
	const isCssHref = href.toLowerCase().includes('.css')
	const isLocalStylesheet = isStylesheet && isCssHref && isLocalHref(href)

	return { href, ok: isLocalStylesheet }
}

function stripDangerousProperties(properties: Record<string, unknown>) {
	for (const key of Object.keys(properties)) {
		if (key.toLowerCase().startsWith('on')) {
			delete properties[key]
		}
	}

	// `srcdoc` is a common XSS vector; compiled output should never rely on it.
	delete properties.srcdoc

	const urlKeys = ['href', 'src', 'xlinkHref']
	for (const key of urlKeys) {
		const value = properties[key]
		if (typeof value === 'string' && isForbiddenUrl(value)) {
			delete properties[key]
		}
	}
}

function removeForbiddenNodes(node: HastNode, forbiddenTags: Set<string>) {
	if (!node.children) return

	const next: HastNode[] = []
	for (const child of node.children) {
		if (child.type === 'element') {
			const tag = (child.tagName || '').toLowerCase()

			// Remove explicitly forbidden tags.
			if (forbiddenTags.has(tag)) {
				continue
			}

			// Allow engine-compatible stylesheet links only.
			if (tag === 'link') {
				const props = child.properties || {}
				const { ok } = isStylesheetLink(props)
				if (!ok) {
					continue
				}
			}

			if (child.properties) {
				stripDangerousProperties(child.properties)
			}
		}

		next.push(child)
		removeForbiddenNodes(child, forbiddenTags)
	}

	node.children = next
}

const forbiddenTagSet = new Set([...FORBID_TAGS, 'script'].map(t => t.toLowerCase()))

export function sanitizeHtml(html: string): string {
	const tree = parseHtmlFragment(html)

	removeForbiddenNodes(tree, forbiddenTagSet)
	stripDangerousUrls(tree)

	const schema = buildObservedSchema(defaultSchema, tree)
	const sanitized = unified()
		.use(rehypeSanitize, schema)
		.runSync(tree as any)
	return stringifyHtmlFragment(sanitized as unknown as HastNode)
}

export default sanitizeHtml
