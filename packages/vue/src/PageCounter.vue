<script lang="ts">
import type { CounterStyle } from './types'

export interface PageCounterBaseProps {
	/**
	 * HTML tag to render. Defaults to `span`. Use `div` (or another block-level
	 * element) when the counter needs its own line.
	 */
	as?: string
	/**
	 * CSS `<counter-style>` used to format the counter — e.g. `decimal`,
	 * `lower-roman`, `upper-alpha`, or a custom `@counter-style` name. Sets
	 * `--page-counter-style` inline; defaults to `decimal` from the base
	 * stylesheet when omitted.
	 */
	counterStyle?: CounterStyle
}

export interface PageCounterProps extends PageCounterBaseProps {
	type: 'page-number' | 'page-count'
}
</script>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

const props = withDefaults(defineProps<PageCounterProps>(), {
	as: 'span'
})

const style = computed<CSSProperties | undefined>(() =>
	props.counterStyle ? ({ '--page-counter-style': props.counterStyle } as CSSProperties) : undefined
)
</script>

<template>
	<component :is="as" :data-type="type" :style="style" />
</template>
