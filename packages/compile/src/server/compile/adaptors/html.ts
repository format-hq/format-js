import type { CreateOptions, RenderOptions } from './types'

import { Eta } from 'eta'
import { isHtmlDocumentModule, resolvePartialPath } from './html-partials'

/**
 * Eta instance that resolves `include()` names against the document's bundled
 * partials map instead of the filesystem, so includes work identically in the
 * dev worker, at compile time, and inside consumer bundles. `resolvePath` and
 * `readFile` are assigned as instance properties because the Node build of Eta
 * binds its own in the constructor (and the browser build has none).
 */
class DocumentEta extends Eta {
	constructor(partials: Record<string, string>) {
		super({ varName: 'data' })

		this.resolvePath = (templatePath: string, options?: { filepath?: string }) =>
			resolvePartialPath(templatePath, options?.filepath)

		this.readFile = (path: string) => {
			const template = partials[path]

			if (template === undefined) {
				const known = Object.keys(partials)
				const hint = known.length > 0 ? ` Known partials: ${known.join(', ')}` : ''
				throw new Error(`Could not find included template '${path}'.${hint}`)
			}

			return template
		}
	}
}

export default {
	create({ Component, data }: CreateOptions) {
		if (isHtmlDocumentModule(Component)) {
			const eta = new DocumentEta(Component.partials ?? {})
			return eta.renderString(Component.template, data)
		}

		const eta = new Eta({ varName: 'data' })
		return eta.renderString(Component, data)
	},
	render({ element }: RenderOptions) {
		// The engine version is stamped centrally by the renderer (create-renderer
		// for compile, host.ts for dev) via finalizeDocumentHtml, uniformly across
		// every framework — so the adaptor returns the rendered body untouched.
		return element
	}
}
