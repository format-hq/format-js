// Authoring components
export { default as Document, type DocumentProps, type RenderProps } from './Document.vue'
export { default as Layout, type LayoutProps } from './Layout.vue'
export { default as Flow, type FlowProps } from './Flow.vue'
export { default as Stream } from './Stream.vue'

// Content components
export { default as PageBreak } from './PageBreak.vue'
export { default as PageNumber, type PageNumberProps } from './PageNumber.vue'
export { default as PageCount, type PageCountProps } from './PageCount.vue'
export { default as Counter, type CounterProps } from './Counter.vue'
export { default as Ref, type RefProps } from './Ref.vue'
export { default as TableOfContents, type TableOfContentsProps } from './TableOfContents.vue'
export { default as Footnote } from './Footnote.vue'
export { default as Footnotes, type FootnotesProps } from './Footnotes.vue'
export { default as CounterDef, type CounterDefProps } from './CounterDef.vue'
export { default as Numbering, type NumberingProps } from './Numbering.vue'
export { default as NumberingRule, type NumberingRuleProps } from './NumberingRule.vue'
export { default as Scope, type ScopeProps } from './Scope.vue'

// Shared types
export type { CounterStyle, PaginationStrategy, FontMode } from './types'
export { SplitGranularity, TocLeader } from './types'

// Utilities
export { css } from './utils'
