<script lang="ts">
export interface ScopeProps {
	/**
	 * The counter to open a fresh nested instance for across this wrapper's content — a
	 * level of a nested list. Pass several space-separated to scope more than one. A
	 * `<Counter join>` inside reads the whole open stack.
	 */
	counter: string
}
</script>

<!--
	Opens a counter scope around its children and adds no element to the output: a
	<Scope> is the fallback for nesting content that has no element of its own to carry
	the scope. When the content already sits in a container or a <Flow>, mark that
	directly (<ol data-scope="item">, <Flow scope="item">) instead of wrapping.

		<Scope counter="item">
			<Counter name="item" join="." /> First
			<Scope counter="item">
				<Counter name="item" join="." /> Nested
			</Scope>
		</Scope>
-->
<script setup lang="ts">
import Template from './Template.vue'

defineProps<ScopeProps>()
</script>

<template>
	<Template :data-scope="counter">
		<slot></slot>
	</Template>
</template>
