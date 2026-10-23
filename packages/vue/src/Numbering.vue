<script lang="ts">
import type { CounterStyle } from './types'

export interface NumberingProps {
	/**
	 * The default counter style for every counter the document numbers. Per-rule,
	 * per-Counter, and per-Footnotes styles override it. Defaults to `decimal`.
	 */
	counterStyle?: CounterStyle
	/**
	 * Whether headings `h1` through `h6` get the built-in hierarchical numbers. On by
	 * default. Set `false` when your own rules number the headings; that removes the
	 * built-in restarts between heading levels as well as the built-in numbers.
	 */
	defaultHeadings?: boolean
}
</script>

<!--
	Turns on document-wide numbering. By default it numbers headings `h1` through
	`h6` hierarchically — `1`, `1.1`, `1.1.1` — with each level resetting the ones
	beneath it. Add <NumberingRule> children to number other things; they add to the
	default headings. To number headings your own way, set `:default-headings="false"`
	and write rules for them.

	Numbers are resolved before pages are split, so they stay correct across page
	breaks where plain CSS counters would reset.

		<Document title="Report">
			<Numbering />
			...
		</Document>
-->
<script setup lang="ts">
import { type VNode } from 'vue'
import Template from './Template.vue'

// Vue casts an omitted boolean prop to false, which would switch the default
// headings off; the undefined default keeps an omitted prop omitted
withDefaults(defineProps<NumberingProps>(), { defaultHeadings: undefined })
defineSlots<{
	/** Optional `<NumberingRule>` and `<CounterDef>` children that extend the scheme. */
	default?: () => VNode[]
}>()
</script>

<template>
	<Template
		data-type="numbering"
		:data-counter-style="counterStyle"
		:data-default-headings="defaultHeadings === undefined ? undefined : defaultHeadings ? 'true' : 'false'">
		<slot></slot>
	</Template>
</template>
