import type { GeneratedFile } from '../types.ts'
import type { BuildEntryArgs } from './utils.ts'

import { titleize, block, buildBody, starterHint, indent } from './utils.ts'
import { firstStringField } from '../data-schema.ts'

export function buildHtmlEntry(args: BuildEntryArgs): GeneratedFile[] {
	const { documentName, application, width, height, data, empty } = args
	const field = firstStringField(data)

	// Eta reads the data variant. Render a real string field if the data has one,
	// else a literal. HTML documents don't carry static data types.
	const title = empty || !field ? titleize(documentName) : `<%= data.${field} %>`

	// An empty document is a Layout with a placeholder comment; otherwise render
	// the starter heading and hint.
	const body = empty
		? '<!-- Your content goes here -->'
		: buildBody({
				application,
				title,
				hint: starterHint(documentName, 'index.html'),
				classAttr: cls => ` class="${cls}"`
			})

	// HTML is emitted hand-indented: it carries Eta tags, so it's left out of the
	// Prettier pass (see new-document/format.ts). Layout is a <template data-type>
	// element, mirroring the React/Vue components. A Layout with no Flow is a single
	// fixed page — the engine wraps its content in one implicit flow.
	const html = `<template data-type="document" data-title="${title}">
	<template data-type="layout" data-width="${width}px" data-height="${height}px">
${indent(body, 2)}
	</template>
</template>
`

	// The HTML document needs a one-line index.ts sibling that re-exports the
	// template and pulls in any stylesheet, so Studio resolves it like a .tsx or
	// .vue entry.
	const indexTs = block(["export { default } from './index.html'", ...application.imports]) + '\n'

	return [
		{ path: 'index.html', contents: html },
		{ path: 'index.ts', contents: indexTs }
	]
}
