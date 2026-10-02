<script lang="ts">
import type { PageCounterBaseProps } from './PageCounter.vue'
export type PageCountProps = PageCounterBaseProps
</script>

<script setup lang="ts">
import PageCounter from './PageCounter.vue'

const props = defineProps<PageCountProps>()
</script>

<template>
	<PageCounter type="page-count" v-bind="props" />
</template>
