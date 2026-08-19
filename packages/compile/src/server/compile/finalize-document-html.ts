import { parseFragment } from 'parse5'

// One parse over the rendered document to apply Studio's output concerns: the
// target engine version on `data-engine`, and the collected CSS (external/global
// stylesheets in compile, the render worker's css map in dev) as a document-level
// `<style>`. The engine treats a `<style>` placed directly under `<Document>` as
// global styles — built once into a `format-document` @layer and shared into
// every layout — so the document's opening tag is the injection point for both,
// and a single parse locates it once.
//
// Any authored `data-engine` is replaced — the compiler knows the target engine
// version, so it always wins. The style tag is emitted only when there is CSS,
// so documents without styles produce clean output rather than an empty tag.

interface Parse5Location {
	startOffset: number
	endOffset: number
}

interface Parse5Attr {
	name: string
	value: string
}

interface Parse5Node {
	nodeName: string
	tagName?: string
	attrs?: Parse5Attr[]
	childNodes?: Parse5Node[]
	sourceCodeLocation?: { startTag?: Parse5Location } | null
}

const DATA_ENGINE_RE = /\sdata-engine\s*=\s*(['"]).*?\1/i

function getAttr(node: Parse5Node, name: string): string | undefined {
	const attr = node.attrs?.find(candidate => candidate.name === name)
	return attr?.value
}

interface FinalizeDocumentHtmlArgs {
	html: string
	engine: string
	/** Collected document CSS. Empty or omitted emits no style tag. */
	css?: string
}

export function finalizeDocumentHtml(args: FinalizeDocumentHtmlArgs): string {
	const { html, engine, css = '' } = args

	if (!html) {
		return html
	}

	const fragment = parseFragment(html, { sourceCodeLocationInfo: true }) as unknown as Parse5Node

	const documents = (fragment.childNodes ?? []).filter(
		node => node.tagName === 'template' && getAttr(node, 'data-type') === 'document'
	)

	if (documents.length === 0) {
		return html
	}

	if (documents.length > 1) {
		throw new Error(
			`Expected a single root document template, found ${documents.length}. ` +
				'A Format document must have exactly one top-level <template data-type="document">.'
		)
	}

	const [documentNode] = documents
	const startTag = documentNode.sourceCodeLocation?.startTag

	if (!startTag) {
		return html
	}

	const openingTag = html.slice(startTag.startOffset, startTag.endOffset)

	// Replace any existing data-engine, inserting as the first attribute to
	// match the order the SDKs used to emit.
	const withoutEngine = openingTag.replace(DATA_ENGINE_RE, '')
	const stamped = withoutEngine.replace(/^<template/i, `<template data-engine="${engine}"`)

	const styles = css.trim()
	const styleTag = styles ? `<style>${styles}</style>` : ''

	return html.slice(0, startTag.startOffset) + stamped + styleTag + html.slice(startTag.endOffset)
}
