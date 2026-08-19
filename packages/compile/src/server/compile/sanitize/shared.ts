import { unified } from 'unified'
import rehypeStringify from 'rehype-stringify'
import { parseFragment } from 'parse5'
import { fromParse5 } from 'hast-util-from-parse5'

// See SANITIZE.md in this directory for the design rationale and behavioural decisions.

export type HastNode = {
	type: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
	content?: HastNode
}

function isDangerousProperty(key: string): boolean {
	const lower = key.toLowerCase()
	return lower.startsWith('on') || lower === 'srcdoc'
}

// Schemes stripped from href/xlink:href (the link blocklist).
const DANGEROUS_URL_SCHEMES = ['javascript:', 'vbscript:', 'data:', 'file:', 'blob:']
// Compared case-insensitively against hast property names — rehype produces
// `xLinkHref` (capital L) for SVG `xlink:href`, so we normalise before matching.
const NAVIGATIONAL_URL_PROPS = ['href', 'xlinkhref']

export function isDangerousUrl(value: string): boolean {
	// Strip whitespace/control chars before testing the scheme — browsers ignore
	// them when resolving a URL, so `java\tscript:` would otherwise slip through.
	const normalized = [...value]
		.filter(ch => ch.charCodeAt(0) > 0x20)
		.join('')
		.toLowerCase()
	return DANGEROUS_URL_SCHEMES.some(scheme => normalized.startsWith(scheme))
}

export function stripDangerousUrls(node: HastNode, onStrip?: () => void) {
	const props = node.properties

	if (props) {
		for (const key of Object.keys(props)) {
			const isNavigational = NAVIGATIONAL_URL_PROPS.includes(key.toLowerCase())
			const value = props[key]

			if (isNavigational && typeof value === 'string' && isDangerousUrl(value)) {
				delete props[key]
				onStrip?.()
			}
		}
	}

	for (const child of node.children || []) {
		stripDangerousUrls(child, onStrip)
	}
}

function collectSchema(node: HastNode, tagNames: Set<string>, attributes: Map<string, Set<string>>) {
	if (node.type === 'element' && node.tagName) {
		const tag = node.tagName
		tagNames.add(tag)

		const props = node.properties || {}
		let set = attributes.get(tag)
		if (!set) {
			set = new Set()
			attributes.set(tag, set)
		}

		for (const key of Object.keys(props)) {
			if (!isDangerousProperty(key)) {
				set.add(key)
			}
		}
	}

	for (const child of node.children || []) {
		collectSchema(child, tagNames, attributes)
	}
}

export function buildObservedSchema(defaultSchema: any, tree: HastNode, keepUnknownTags = false) {
	const tagNames = new Set<string>()
	const attributesByTag = new Map<string, Set<string>>()
	collectSchema(tree, tagNames, attributesByTag)

	const mergedAttributes: Record<string, unknown> = { ...(defaultSchema as any).attributes }
	for (const [tag, attrs] of attributesByTag) {
		const base = mergedAttributes[tag]
		if (Array.isArray(base)) {
			// When an observed attribute (unrestricted string) collides with a
			// defaultSchema tuple like ['className', 'specific-value'], the tuple
			// must be removed. hast-util-sanitize's findDefinition returns the
			// first match — if the restricted tuple comes first the unrestricted
			// string is never reached, silently dropping valid attribute values.
			const filtered = base.filter((entry: unknown) => {
				if (Array.isArray(entry) && typeof entry[0] === 'string') {
					return !attrs.has(entry[0])
				}
				return true
			})
			mergedAttributes[tag] = [...new Set([...filtered, ...attrs])]
		} else {
			mergedAttributes[tag] = [...attrs]
		}
	}

	// Parent-less fragments must survive, so the structural `ancestors` rule is off.
	const ancestors = {}

	const protocols = { ...(defaultSchema as any).protocols }
	// href is policed by stripDangerousUrls (a blocklist), not this whitelist.
	delete protocols.href
	// Allow data: image sources.
	protocols.src = [...(protocols.src ?? []), 'data']

	return {
		...defaultSchema,
		// Keep stable IDs/names and avoid GitHub-style clobbering.
		clobber: [],
		clobberPrefix: '',
		tagNames: [...new Set([...((defaultSchema as any).tagNames ?? []), ...tagNames])],
		attributes: mergedAttributes,
		ancestors,
		protocols,
		...(keepUnknownTags ? { strip: [] } : {})
	}
}

export function templateContentToChildren(node: HastNode) {
	if (node.type === 'element' && (node.tagName || '').toLowerCase() === 'template' && node.content) {
		// `rehype-sanitize` strips the non-standard `content` field.
		// Move it into `children` before sanitization.
		node.children = Array.isArray(node.content.children) ? node.content.children : []
		delete (node as any).content
	}

	for (const child of node.children || []) templateContentToChildren(child)
}

export function templateChildrenToContent(node: HastNode) {
	if (node.type === 'element' && (node.tagName || '').toLowerCase() === 'template') {
		const kids = node.children || []
		node.children = []
		node.content = { type: 'root', children: kids }
		for (const child of kids) templateChildrenToContent(child)
		return
	}

	for (const child of node.children || []) templateChildrenToContent(child)
}

// Parse with parse5 + hast-util-from-parse5 directly rather than through rehype-parse.
// rehype-parse routes through hast-util-from-html, which always passes a VFile to
// fromParse5, and fromParse5 with a `file` resolves every node's source offset to a
// line/column point — quadratic on a large document (~12s here vs ~40ms without). We
// never use source positions for sanitization, so skip the file and the location info
// entirely. `scriptingEnabled: false` matches rehype-parse's template/noscript parsing,
// so the resulting tree is unchanged.
export function parseHtmlFragment(html: string): HastNode {
	const parsed = parseFragment(html, { sourceCodeLocationInfo: false, scriptingEnabled: false })
	const tree = fromParse5(parsed) as unknown as HastNode
	templateContentToChildren(tree)
	return tree
}

export function stringifyHtmlFragment(tree: HastNode): string {
	templateChildrenToContent(tree)
	const out = unified()
		.use(rehypeStringify, { allowDangerousHtml: false })
		.stringify(tree as any)
	return String(out).trim()
}

export function removeTags(node: HastNode, forbiddenTags: Set<string>, onRemove?: (tag: string) => void) {
	if (!node.children) return

	const next: HastNode[] = []
	for (const child of node.children) {
		if (child.type === 'element') {
			const tag = (child.tagName || '').toLowerCase()
			if (forbiddenTags.has(tag)) {
				onRemove?.(tag)
				continue
			}
		}

		next.push(child)
		removeTags(child, forbiddenTags, onRemove)
	}

	node.children = next
}
