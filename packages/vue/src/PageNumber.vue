<script lang="ts">
import type { PageCounterBaseProps } from './PageCounter.vue'
export type PageNumberProps = PageCounterBaseProps
</script>

<script setup lang="ts">
import PageCounter from './PageCounter.vue'

const props = defineProps<PageNumberProps>()
</script>

<template>
	<PageCounter type="page-number" v-bind="props" />
</template>
