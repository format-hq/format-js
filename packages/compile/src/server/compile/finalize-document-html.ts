import { parseFragment } from 'parse5'

// One parse over the rendered document to apply Studio's output concerns: the
// release that produced it on `data-sdk`, the target engine version on
// `data-engine`, and the collected CSS (external/global stylesheets in compile,
// the render worker's css map in dev) as a document-level `<style>`. The engine
// treats a `<style>` placed directly under `<Document>` as global styles — built
// once into a `format-document` @layer and shared into every layout — so the
// document's opening tag is the injection point for all three, and a single
// parse locates it once.
//
// The two version attributes are generated, never authored. What an SDK already
// wrote is checked rather than replaced: a document React or Vue stamped names
// the release that rendered it, and a compiler from a different release
// overwriting that stamp would relabel mixed output as though one coherent
// release produced it. A document carrying no `data-sdk` was authored as HTML,
// which is a supported input, so it takes this compiler's numbers.

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
	sourceCodeLocation?: { startTag?: Parse5Location; attrs?: Record<string, Parse5Location> } | null
}

/** The two attributes this module owns, in the order it writes them. */
const GENERATED = ['data-sdk', 'data-engine'] as const

function getAttr(node: Parse5Node, name: string): string | undefined {
	const attr = node.attrs?.find(candidate => candidate.name === name)
	return attr?.value
}

/**
 * Raised when the SDK that rendered a document and the compiler finalising it
 * come from different Format releases.
 *
 * A distinct class because the fix is a distinct action — bring the installed
 * Format packages to one release — and because the alternative is the failure
 * this check exists to prevent: output produced by two releases, stamped as
 * though one release produced all of it, and diagnosed months later against a
 * release that never rendered any of it.
 */
export class ProducerVersionMismatchError extends Error {
	readonly documentSdk: string
	readonly documentEngine: string | undefined
	readonly compilerSdk: string
	readonly compilerEngine: string

	constructor(args: { documentSdk: string; documentEngine?: string; compilerSdk: string; compilerEngine: string }) {
		const engines =
			args.documentEngine !== undefined && args.documentEngine !== args.compilerEngine
				? ` and targets engine ${args.documentEngine} where this compiler targets ${args.compilerEngine}`
				: ''

		super(
			`This document was rendered by Format ${args.documentSdk}${engines}, and is being compiled by Format ` +
				`${args.compilerSdk}. Format will not stamp one release's number onto another release's output. ` +
				'Bring every @format.dev/* package to one version — `format update` does it — and compile again.'
		)

		this.name = 'ProducerVersionMismatchError'
		this.documentSdk = args.documentSdk
		this.documentEngine = args.documentEngine
		this.compilerSdk = args.compilerSdk
		this.compilerEngine = args.compilerEngine
	}
}

interface FinalizeDocumentHtmlArgs {
	html: string
	/** J: the release this compiler belongs to, written as `data-sdk`. */
	sdk: string
	/** E: the released engine that release targets, written as `data-engine`. */
	engine: string
	/** Collected document CSS. Empty or omitted emits no style tag. */
	css?: string
}

/** The document template's opening tag, and where it sits in the html. */
interface DocumentOpenTag {
	tag: string
	startOffset: number
	endOffset: number
	sdk: string | undefined
	engine: string | undefined
	/**
	 * Where each attribute of the tag actually is, relative to the tag's start.
	 *
	 * Used to remove an attribute by cutting it out at the offsets the parser
	 * reported. A regular expression cannot do this: `data-sdk="0.1.0"` written
	 * inside a title as an example matches one, and stripping that match deletes
	 * part of the title. The parser already knows which occurrence is an attribute
	 * and which is text, so the answer is taken from it rather than re-derived.
	 */
	attributeAt: Record<string, { from: number; to: number }>
}

/**
 * The one `<template data-type="document">` at the top of the fragment.
 *
 * Returns null when the html holds no document template, or when parse5 could
 * not report where its opening tag ends — in both cases the caller returns the
 * html untouched, because there is nowhere to write.
 */
function findDocumentTemplate(html: string): DocumentOpenTag | null {
	const fragment = parseFragment(html, { sourceCodeLocationInfo: true }) as unknown as Parse5Node

	const documents = (fragment.childNodes ?? []).filter(
		node => node.tagName === 'template' && getAttr(node, 'data-type') === 'document'
	)

	if (documents.length === 0) {
		return null
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
		return null
	}

	const attributeAt: DocumentOpenTag['attributeAt'] = {}

	for (const [name, at] of Object.entries(documentNode.sourceCodeLocation?.attrs ?? {})) {
		attributeAt[name] = { from: at.startOffset - startTag.startOffset, to: at.endOffset - startTag.startOffset }
	}

	return {
		tag: html.slice(startTag.startOffset, startTag.endOffset),
		startOffset: startTag.startOffset,
		endOffset: startTag.endOffset,
		sdk: getAttr(documentNode, 'data-sdk'),
		engine: getAttr(documentNode, 'data-engine'),
		attributeAt
	}
}

/**
 * The opening tag with `names` cut out of it, at the offsets the parser gave.
 *
 * Removed back to front so an earlier removal does not move a later offset, and
 * the space in front of each attribute goes with it so the tag does not
 * accumulate gaps.
 */
function withoutAttributes(document: DocumentOpenTag, names: readonly string[]): string {
	const spans = names
		.map(name => document.attributeAt[name])
		.filter((at): at is { from: number; to: number } => at !== undefined)
		.sort((a, b) => b.from - a.from)

	let tag = document.tag

	for (const at of spans) {
		const from = /\s/.test(tag[at.from - 1] ?? '') ? at.from - 1 : at.from
		tag = tag.slice(0, from) + tag.slice(at.to)
	}

	return tag
}

/**
 * Stamp a rendered document with this compiler's release numbers, and inject
 * the collected CSS.
 *
 * Throws `ProducerVersionMismatchError` when the document already names a
 * different producing release. The check runs before anything is written, so a
 * mismatched document leaves this function unchanged rather than half-stamped.
 */
export function finalizeDocumentHtml(args: FinalizeDocumentHtmlArgs): string {
	const { html, sdk, engine, css = '' } = args

	if (!html) {
		return html
	}

	const document = findDocumentTemplate(html)

	if (!document) {
		return html
	}

	// An SDK-rendered document names its own producer. Equal is the only
	// acceptable answer; a document that names no producer was authored as HTML
	// and takes this compiler's numbers.
	const authored = document.sdk?.trim()

	if (authored && (authored !== sdk || (document.engine?.trim() ?? engine) !== engine)) {
		throw new ProducerVersionMismatchError({
			documentSdk: authored,
			documentEngine: document.engine?.trim(),
			compilerSdk: sdk,
			compilerEngine: engine
		})
	}

	const styles = css.trim()
	const styleTag = styles ? `<style>${styles}</style>` : ''

	return (
		html.slice(0, document.startOffset) +
		stampProducer(document, sdk, engine) +
		styleTag +
		html.slice(document.endOffset)
	)
}

/**
 * Rewrite the engine version onto an already-finalised document, leaving
 * `data-sdk` alone.
 *
 * Studio calls this to preview against a locally built engine. Only the engine
 * changes: `data-sdk` says which release built the document, and that is still
 * true when a local engine renders it.
 */
export function restampDocumentEngine(html: string, engine: string): string {
	if (!html) {
		return html
	}

	const document = findDocumentTemplate(html)

	if (!document) {
		return html
	}

	const stamped = withoutAttributes(document, ['data-engine']).replace(
		/^<template/i,
		`<template data-engine="${engine}"`
	)

	return html.slice(0, document.startOffset) + stamped + html.slice(document.endOffset)
}

/**
 * Write both version attributes into the opening tag, replacing whatever was
 * there.
 *
 * Inserted at the front, in the order React and Vue emit them, so a document
 * that went through an SDK and a document that did not are byte-identical about
 * the part that names their provenance.
 */
function stampProducer(document: DocumentOpenTag, sdk: string, engine: string): string {
	return withoutAttributes(document, GENERATED).replace(
		/^<template/i,
		`<template data-sdk="${sdk}" data-engine="${engine}"`
	)
}
