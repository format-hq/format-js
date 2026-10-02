import type { PropsWithChildren } from 'react'
import { Template } from './Template'
import type { PaginationStrategy, SplitGranularity } from './types'

export interface LayoutProps {
	/** Design label, mirrored to each page as `data-layout-id` for CSS. Optional:
	 * when omitted, the engine generates one from the Layout's document position. */
	id?: string
	width: number
	height: number
	paginationStrategy?: PaginationStrategy
	splitGranularity?: SplitGranularity
}

export function Layout({
	id,
	width,
	height,
	paginationStrategy,
	splitGranularity,
	children
}: PropsWithChildren<LayoutProps>) {
	return (
		<Template
			data-type='layout'
			data-id={id}
			data-width={`${width}px`}
			data-height={`${height}px`}
			data-pagination-strategy={paginationStrategy}
			data-split-granularity={splitGranularity}>
			{children}
		</Template>
	)
}
