<script lang="ts">
import type { PaginationStrategy, SplitGranularity } from './types'

export interface LayoutProps {
	/** Design label, mirrored to each page as `data-layout-id` for CSS. Optional:
	 * when omitted, the engine generates one from the Layout's document position. */
	id?: string
	width: number
	height: number
	paginationStrategy?: PaginationStrategy
	splitGranularity?: SplitGranularity
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import Template from './Template.vue'

const props = defineProps<LayoutProps>()

const widthPx = computed(() => `${props.width}px`)
const heightPx = computed(() => `${props.height}px`)
</script>

<template>
	<Template
		data-type="layout"
		:data-id="id"
		:data-width="widthPx"
		:data-height="heightPx"
		:data-pagination-strategy="paginationStrategy"
		:data-split-granularity="splitGranularity">
		<slot></slot>
	</Template>
</template>
