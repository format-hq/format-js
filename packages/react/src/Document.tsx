import type { PropsWithChildren } from 'react'
import { Template } from './Template'
import type { FontMode } from './types'
import { engineTarget } from './engine-target'

export interface DocumentProps {
	title: string
	subject?: string
	author?: string
	keywords?: string[]
	/**
	 * How the PDF embeds its fonts — file size against rendering quality. Leave
	 * unset for most documents; set `'fidelity'` when exact text rendering
	 * matters more than file size.
	 *
	 * - Compact (the default) keeps files small: the fonts embed as subset CID
	 *   instances, so the optical size is fixed and strokes can look slightly
	 *   heavier in some viewers (for example macOS Preview).
	 * - Fidelity gives the best-looking output: text keeps its exact optical
	 *   sizing and renders at the same weight in every PDF viewer. The cost is a
	 *   larger file, since the fonts embed as Type 3.
	 */
	fonts?: FontMode
}

/**
 * Props the Format runtime passes to a document entry function. The
 * generic parameter is the shape of the active data variant.
 *
 * ```tsx
 * import type { Invoice } from './types'
 *
 * export default function InvoiceDocument({ data }: RenderProps<Invoice>) {
 *   return <Document title={`Invoice #${data.id}`}>{/* ... *\/}</Document>
 * }
 * ```
 */
export interface RenderProps<T = unknown> {
	data: T
}

export function Document({ title, subject, author, keywords, fonts, children }: PropsWithChildren<DocumentProps>) {
	const keywordsString = keywords?.join(', ')

	return (
		<Template
			data-engine={engineTarget}
			data-type='document'
			data-title={title}
			data-subject={subject}
			data-author={author}
			data-keywords={keywordsString}
			data-fonts={fonts}>
			{children}
		</Template>
	)
}
