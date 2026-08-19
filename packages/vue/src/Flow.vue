<script lang="ts">
import type { PaginationStrategy, SplitGranularity } from './types'

export interface FlowProps {
	splitGranularity?: SplitGranularity
	paginationStrategy?: PaginationStrategy
	scope?: string
}
</script>

<script setup lang="ts">
import Template from './Template.vue'

defineProps<FlowProps>()
</script>

<template>
	<Template
		data-type="flow"
		:data-split-granularity="splitGranularity"
		:data-pagination-strategy="paginationStrategy"
		:data-scope="scope">
		<slot></slot>
	</Template>
</template>
