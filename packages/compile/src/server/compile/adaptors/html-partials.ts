export interface HtmlDocumentModule {
	template: string
	partials: Record<string, string>
}

/**
 * Partial keys are posix-style paths relative to the document entry. Leading
 * `..` segments are kept so a partial can reference a sibling directory and
 * still resolve to the same key the loader emitted.
 */
export function normalizePartialPath(path: string): string {
	const segments: string[] = []

	for (const segment of path.split('/')) {
		if (!segment || segment === '.') {
			continue
		}

		if (segment === '..' && segments.length > 0 && segments[segments.length - 1] !== '..') {
			segments.pop()
			continue
		}

		segments.push(segment)
	}

	return segments.join('/')
}

export function resolvePartialPath(name: string, baseFilePath?: string): string {
	const baseDir = baseFilePath ? baseFilePath.split('/').slice(0, -1).join('/') : ''
	return normalizePartialPath(baseDir ? `${baseDir}/${name}` : name)
}

export function isHtmlDocumentModule(value: unknown): value is HtmlDocumentModule {
	return typeof value === 'object' && value !== null && typeof (value as HtmlDocumentModule).template === 'string'
}

const INCLUDE_RE = /\binclude(?:Async)?\s*\(\s*(['"])((?:\.{1,2}\/)?[^'"]+?\.html)\1/g

/**
 * Static include specifiers referenced by a template, in source order and
 * deduplicated. Only string-literal paths can be discovered at build time;
 * a computed include name still works at render time when its target is
 * pulled in by a literal include elsewhere in the document.
 */
export function findIncludeSpecifiers(template: string): string[] {
	const specifiers = new Set<string>()

	for (const match of template.matchAll(INCLUDE_RE)) {
		specifiers.add(match[2])
	}

	return [...specifiers]
}

export function addPartial(
	partials: Record<string, string>,
	specifier: string,
	child: HtmlDocumentModule | string
): void {
	const key = normalizePartialPath(specifier)

	if (typeof child === 'string') {
		partials[key] = child
		return
	}

	partials[key] = child.template

	for (const [childKey, childTemplate] of Object.entries(child.partials ?? {})) {
		partials[resolvePartialPath(childKey, key)] = childTemplate
	}
}
