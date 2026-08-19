<script lang="ts">
import type { FontMode } from './types'

/**
 * Props the Format runtime passes to a document entry function. The
 * generic parameter is the shape of the active data variant.
 *
 * In `<script setup>`:
 *
 *     import type { RenderProps } from '@format.dev/vue'
 *     import type { Invoice } from './types'
 *
 *     defineProps<RenderProps<Invoice>>()
 */
export interface RenderProps<T = unknown> {
	data: T
}

export interface DocumentProps {
	title: string
	subject?: string
	author?: string
	keywords?: string[]
	/**
	 * How the PDF embeds its fonts — file size against rendering quality. Leave
	 * unset for most documents; set `'fidelity'` when exact text rendering
	 * matters more than file size.
	 *
	 * - Compact (the default) keeps files small: the fonts embed as subset CID
	 *   instances, so the optical size is fixed and strokes can look slightly
	 *   heavier in some viewers (for example macOS Preview).
	 * - Fidelity gives the best-looking output: text keeps its exact optical
	 *   sizing and renders at the same weight in every PDF viewer. The cost is a
	 *   larger file, since the fonts embed as Type 3.
	 */
	fonts?: FontMode
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import Template from './Template.vue'
import { engineTarget } from './engine-target'

defineOptions({ inheritAttrs: false })

const props = defineProps<DocumentProps>()

const keywordsString = computed(() => props.keywords?.join(', ') || undefined)
</script>

<template>
	<Template
		:data-engine="engineTarget"
		data-type="document"
		:data-title="title"
		:data-subject="subject"
		:data-author="author"
		:data-keywords="keywordsString"
		:data-fonts="fonts">
		<slot></slot>
	</Template>
</template>
