<script lang="ts">
import type { CounterStyle } from './types'

export interface NumberingProps {
	/**
	 * The default counter style for every counter the document numbers. Per-rule,
	 * per-Counter, and per-Footnotes styles override it. Defaults to `decimal`.
	 */
	counterStyle?: CounterStyle
}
</script>

<!--
	Turns on document-wide numbering. With no children it numbers headings `h1`
	through `h6` hierarchically — `1`, `1.1`, `1.1.1` — with each level resetting
	the ones beneath it. Add <NumberingRule> children to number other things or
	change the format.

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

defineProps<NumberingProps>()
defineSlots<{
	/** Optional `<NumberingRule>` children that customize the scheme. */
	default?: () => VNode[]
}>()
</script>

<template>
	<Template data-type="numbering" :data-counter-style="counterStyle">
		<slot></slot>
	</Template>
</template>
