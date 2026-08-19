import type { Framework } from '../../shared.ts'
import type { StyleApplication } from '../types.ts'

export interface BuildEntryArgs {
	framework: Framework
	documentName: string
	application: StyleApplication
	// Page dimensions in CSS pixels, written onto the starter Layout.
	width: number
	height: number
	// When true, the entry imports its data type from ./data/schema (inferred);
	// otherwise it declares a local type from the sample data.
	emitSchema: boolean
	// The default data variant, used to type `data` and pick a field to render.
	data: unknown
	// Scaffold an empty document: a static title, no data prop, and an empty
	// Layout with a placeholder comment for the user to build on.
	empty: boolean
}

export function starterHint(documentName: string, entryFile: string): string {
	return `Edit documents/${documentName}/${entryFile} to get started`
}

export function indent(text: string, tabs: number): string {
	const pad = '\t'.repeat(tabs)
	return text
		.split('\n')
		.map(line => (line ? pad + line : line))
		.join('\n')
}

function capitalize(word: string): string {
	return word ? word[0].toUpperCase() + word.slice(1) : ''
}

function words(name: string): string[] {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
}

// "monthly-invoice" → "MonthlyInvoice", used for the component and interface names.
export function pascalCase(name: string): string {
	return words(name)
		.map(word => capitalize(word.toLowerCase()))
		.join('')
}

// "monthly-invoice" → "Monthly Invoice", used for the literal document title.
export function titleize(name: string): string {
	return words(name)
		.map(word => capitalize(word.toLowerCase()))
		.join(' ')
}

// The name of the type describing a document's data, e.g. "InvoiceData".
export function dataTypeName(name: string): string {
	return `${pascalCase(name)}Data`
}

export function block(lines: string[]): string {
	return lines.filter(Boolean).join('\n')
}

interface BuildBodyArgs {
	application: StyleApplication
	title: string
	hint: string
	// Renders a static class attribute, e.g. `class="hint"`.
	classAttr: (cls: string) => string
	// Renders a bound class expression, e.g. `className={styles.hint}`. Only the
	// frameworks that support a scoped module (React, Vue) provide this.
	classExprAttr?: (expr: string) => string
}

interface ClassAttrArgs {
	// A literal class list, e.g. 'my-2 text-2xl'.
	literal?: string
	// A bound class expression, e.g. 'styles.hint'. Takes precedence when set.
	expr?: string
	classAttr: (cls: string) => string
	classExprAttr?: (expr: string) => string
}

function buildClassAttr(args: ClassAttrArgs): string {
	const { literal, expr, classAttr, classExprAttr } = args

	if (expr && classExprAttr) {
		return classExprAttr(expr)
	}

	if (literal) {
		return classAttr(literal)
	}

	return ''
}

// Build the heading + hint markup (optionally wrapped). The strategy decides the
// tags, the wrapper, and the classes; the framework decides how a class binds.
export function buildBody(args: BuildBodyArgs): string {
	const { application, title, hint, classAttr, classExprAttr } = args

	const headingClassAttr = buildClassAttr({
		literal: application.headingClass,
		expr: application.headingClassExpr,
		classAttr,
		classExprAttr
	})
	const hintClassAttr = buildClassAttr({
		literal: application.hintClass,
		expr: application.hintClassExpr,
		classAttr,
		classExprAttr
	})

	const heading = `<${application.headingTag}${headingClassAttr}>${title}</${application.headingTag}>`
	const hintEl = `<${application.hintTag}${hintClassAttr}>${hint}</${application.hintTag}>`
	const lines = `${heading}\n${hintEl}`

	if (!application.wrapperTag) {
		return lines
	}

	return `<${application.wrapperTag}>\n${indent(lines, 1)}\n</${application.wrapperTag}>`
}
