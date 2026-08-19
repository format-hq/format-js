<script setup lang="ts">
import { h, ref, onMounted, type VNode, useAttrs } from 'vue'

const attrs = useAttrs()
const slots = defineSlots<{
	default?: () => VNode[]
}>()

const tpl = ref<HTMLTemplateElement | null>(null)

onMounted(() => {
	const el = tpl.value
	if (!el) return

	// vue will render children incorrectly as direct child nodes,
	// so we need to move them into the template.content manually
	if (el.content.childNodes.length === 0) {
		const children = Array.from(el.childNodes)
		children.forEach(node => el.content.appendChild(node))
	}
})

const render = () => h('template', { ...attrs, ref: tpl }, slots.default?.() ?? [])
</script>

<template>
	<render />
</template>
