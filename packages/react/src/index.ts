// Authoring components
export { Document, type DocumentProps, type RenderProps } from './Document'
export { Layout, type LayoutProps } from './Layout'
export { Flow, type FlowProps } from './Flow'
export { Stream } from './Stream'

// Content components
export { PageBreak } from './PageBreak'
export { PageNumber, type PageNumberProps } from './PageNumber'
export { PageCount, type PageCountProps } from './PageCount'
export { Counter, type CounterProps } from './Counter'
export {
	CounterDef,
	Numbering,
	NumberingRule,
	type CounterDefProps,
	type NumberingProps,
	type NumberingRuleProps
} from './Numbering'
export { Scope, type ScopeProps } from './Scope'
export { Ref, type RefProps } from './Ref'
export { TableOfContents, type TableOfContentsProps } from './TableOfContents'
export { Footnote } from './Footnote'
export { Footnotes, type FootnotesProps } from './Footnotes'

// Shared types
export type { CounterStyle, PaginationStrategy, FontMode } from './types'
export { SplitGranularity, TocLeader } from './types'

// Utilities
export { css } from './utils'
