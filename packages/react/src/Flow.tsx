import type { PropsWithChildren } from 'react'
import { Template } from './Template'
import type { PaginationStrategy, SplitGranularity } from './types'

export interface FlowProps {
	/** How content breaks when it doesn't fit the current page. When unset, it
	 * inherits from the enclosing Flow, then the Layout, then defaults to `none`. */
	splitGranularity?: SplitGranularity
	/** Whether this Flow paginates on overflow (`auto`) or only at PageBreak
	 * markers (`manual`). Inherits the owning Layout's strategy when unset. */
	paginationStrategy?: PaginationStrategy
	/** Opens a numbering scope of this counter name around the Flow's content, so
	 * a counter nested inside restarts per Flow instance (e.g. `1.1`, `1.2`). */
	scope?: string
}

/**
 * A Flow is a region whose content paginates across pages. Everything inside the
 * Flow that isn't its Stream is scaffolding that repeats on every page the
 * content spans; the stream's items appear once and flow.
 *
 * Author the stream two ways:
 *
 * - **bare** — `<Flow>{items}</Flow>`: the Flow's own children are the stream,
 *   injected with no wrapper element.
 * - **scaffolded** — wrap the stream in a `<Stream>` inside surrounding markup,
 *   e.g. `<Flow><table><thead/><Stream>{rows}</Stream><tfoot/></table></Flow>`:
 *   the table, thead, and tfoot repeat per page; the rows flow.
 *
 * Flows nest: a Flow placed inside another Flow's stream paginates against the
 * nearest enclosing sealing region (a Frame, else the page), re-cloning its own
 * scaffolding on each page its content reaches.
 */
export function Flow({ splitGranularity, paginationStrategy, scope, children }: PropsWithChildren<FlowProps>) {
	return (
		<Template
			data-type='flow'
			data-split-granularity={splitGranularity}
			data-pagination-strategy={paginationStrategy}
			data-scope={scope}>
			{children}
		</Template>
	)
}
