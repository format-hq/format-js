<script lang="ts">
import type { CounterStyle } from './types'

export interface NumberingRuleProps {
	/**
	 * CSS selector for the elements this rule numbers, e.g. `h2`, `figure figcaption`,
	 * `.step`. Every match advances the counter in document order.
	 */
	match: string
	/**
	 * The counter this rule advances. Defaults to the selector, so a single-tag
	 * rule needs no separate name.
	 */
	counter?: string
	/**
	 * The text inserted into each match, with `{counter}` placeholders. For
	 * example `Figure {figure}: ` or `{chapter:upper-roman}. `. A placeholder may
	 * carry its own style after a colon. When omitted, the rule advances the
	 * counter but inserts nothing — pair it with a <Counter> read.
	 */
	format?: string
	/**
	 * How much to advance the counter on each match. Defaults to 1. Set to `0` to insert
	 * a counter's value without advancing it.
	 */
	increment?: number
	/**
	 * Set the counter to this exact value on each match instead of advancing it.
	 * Mutually exclusive with `increment`; setting both is a runtime error in dev,
	 * since Vue props can't express the either/or a TypeScript union would.
	 */
	set?: number
	/**
	 * Default `<counter-style>` for placeholders in `format`. Defaults to `decimal`.
	 */
	counterStyle?: CounterStyle
	/**
	 * Where the formatted number goes relative to the matched element:
	 * `before` its content (the default), `after` it, or `none` to only keep the
	 * counter running. To restart a counter under another, declare it with
	 * `<CounterDef resetEach>`; to nest a counter, mark the container `data-scope`.
	 */
	insert?: 'before' | 'after' | 'none'
}
</script>

<script setup lang="ts">
import Template from './Template.vue'

const props = defineProps<NumberingRuleProps>()

// defineProps can't express the set/increment XOR a TS union would, so this
// runtime check enforces it in dev; keep it when editing the props above
if (
	typeof process !== 'undefined' &&
	process.env?.NODE_ENV !== 'production' &&
	props.set !== undefined &&
	props.increment !== undefined
) {
	console.error(
		'<NumberingRule>: `set` and `increment` are mutually exclusive; `set` forces an exact value and wins, `increment` is ignored.'
	)
}
</script>

<template>
	<Template
		data-type="numbering-rule"
		:data-match="match"
		:data-counter="counter"
		:data-format="format"
		:data-increment="increment"
		:data-set="set"
		:data-counter-style="counterStyle"
		:data-insert="insert" />
</template>
