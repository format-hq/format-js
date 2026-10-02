<script lang="ts">
export interface CounterDefProps {
	/** The counter this defines. Shared by name across the document. */
	name: string
	/**
	 * The counter this one restarts under, if any: whenever that owner advances, this
	 * counter returns to 0. A `figure` set to restart under `chapter` reads "Figure 2.1".
	 * The restart cascades, so a new chapter zeros section and, under section, figure.
	 */
	resetEach?: string
}
</script>

<!--
	Declares one counter's behaviour, used as <CounterDef> inside <Numbering>. Name the
	counter and, optionally, the owner counter it restarts under. A counter with an owner
	returns to 0 every time the owner's value changes; one with no owner restarts only when
	you reset or set it yourself.

		<Numbering>
			<CounterDef name="figure" resetEach="chapter" />
			<NumberingRule match="figcaption" counter="figure" format="Figure {chapter}.{figure}: " />
		</Numbering>
-->
<script setup lang="ts">
import Template from './Template.vue'

defineProps<CounterDefProps>()
</script>

<template>
	<Template data-type="counter-def" :data-name="name" :data-reset-each="resetEach" />
</template>
