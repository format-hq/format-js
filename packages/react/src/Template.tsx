import type { PropsWithChildren } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { stripImagePreloads } from './utils'

export type TemplateProps = React.HTMLAttributes<HTMLTemplateElement>

export function Template({ children, ...props }: PropsWithChildren<TemplateProps>) {
	const html = stripImagePreloads(renderToStaticMarkup(children))
	return <template {...props} dangerouslySetInnerHTML={{ __html: html }} />
}
