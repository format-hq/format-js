import type { Plugin } from 'vite'

import { readFileSync } from 'node:fs'
import { findIncludeSpecifiers, normalizePartialPath } from '../../compile/adaptors/html-partials'

function splitId(id: string) {
	const [cleanId, query = ''] = id.split('?', 2)
	return { cleanId, query }
}

function hasQueryParam(query: string, key: string) {
	if (!query) return false

	return query.split('&').some(param => {
		const [name] = param.split('=', 1)
		return name === key
	})
}

/**
 * Emit the JS module for an .html import. A template with no `include()` stays
 * a plain string export. A template with includes imports each included file
 * (so partials are bundled, watched, and HMR-tracked like any module) and
 * exports `{ template, partials }`, with partial keys resolved relative to
 * this file — the shape `adaptors/html-partials.ts` resolves against at render
 * time. The key-joining helpers are inlined because this code runs inside the
 * user's bundle, where studio modules can't be imported.
 */
export function buildHtmlModule(template: string): string {
	const specifiers = findIncludeSpecifiers(template)

	if (specifiers.length === 0) {
		return `export default ${JSON.stringify(template)};`
	}

	const imports = specifiers
		.map((specifier, index) => `import __partial${index} from ${JSON.stringify(specifier)};`)
		.join('\n')

	const registrations = specifiers
		.map((specifier, index) => `__addPartial(${JSON.stringify(normalizePartialPath(specifier))}, __partial${index});`)
		.join('\n')

	return `${imports}
const __partials = {};
const __normalize = (path) => {
	const segments = [];
	for (const segment of path.split('/')) {
		if (!segment || segment === '.') continue;
		if (segment === '..' && segments.length > 0 && segments[segments.length - 1] !== '..') {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return segments.join('/');
};
const __addPartial = (key, child) => {
	if (typeof child === 'string') {
		__partials[key] = child;
		return;
	}
	__partials[key] = child.template;
	const baseDir = key.split('/').slice(0, -1).join('/');
	for (const childKey of Object.keys(child.partials || {})) {
		__partials[__normalize(baseDir ? baseDir + '/' + childKey : childKey)] = child.partials[childKey];
	}
};
${registrations}
export default { template: ${JSON.stringify(template)}, partials: __partials };`
}

const HTML_PROXY_RE = /\.html\?html-proxy\b/i

export function htmlLoader(): Plugin {
	return {
		name: 'format-html-loader',
		enforce: 'pre',

		async resolveId(source, importer) {
			// Swallow Vite's internal HTML proxy ids for actual HTML files.
			if (HTML_PROXY_RE.test(source)) {
				return source
			}

			const { cleanId, query } = splitId(source)

			// Treat .html imports as raw string modules
			if (cleanId.endsWith('.html') && !hasQueryParam(query, 'raw')) {
				const resolved = await this.resolve(source, importer, { skipSelf: true })

				if (resolved) {
					const resolvedParts = splitId(resolved.id)
					const rawQuery = [resolvedParts.query, 'raw'].filter(Boolean).join('&')
					return `${resolvedParts.cleanId}?${rawQuery}`
				}
			}

			return null
		},

		async load(id: string) {
			// Stub any .html?html-proxy requests so HTML files don't execute inline modules.
			if (HTML_PROXY_RE.test(id)) {
				return 'export default "";'
			}

			const { cleanId, query } = splitId(id)
			const isRawHtmlRequest = cleanId.endsWith('.html') && hasQueryParam(query, 'raw')

			// Load the actual HTML as a JS string module
			if (isRawHtmlRequest) {
				const code = readFileSync(cleanId, 'utf8')
				return buildHtmlModule(code)
			}

			return null
		}
	}
}
