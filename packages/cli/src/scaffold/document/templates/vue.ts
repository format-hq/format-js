import type { GeneratedFile } from '../types.ts'
import type { BuildEntryArgs } from './utils.ts'

import { firstStringField, jsonToTsType } from '../data-schema.ts'

import { dataTypeName, titleize, block, buildBody, starterHint, indent } from './utils.ts'

export function buildVueEntry(args: BuildEntryArgs): GeneratedFile {
	const { documentName, application, width, height, emitSchema, data, empty } = args
	const dataType = dataTypeName(documentName)

	const trailingStyles = application.vueStyleBlock ? `\n${application.vueStyleBlock}\n` : '\n'

	if (empty) {
		const scriptImports = block(["import { Document, Layout } from '@format.dev/vue'", ...application.imports])

		const contents = `<script setup lang="ts">
${scriptImports}
</script>

<template>
	<Document title="${titleize(documentName)}">
		<Layout :width="${width}" :height="${height}">
			<!-- Your content goes here -->
		</Layout>
	</Document>
</template>
${trailingStyles}`

		return { path: 'index.vue', contents }
	}

	const scriptImports = block([
		"import { Document, Layout, type RenderProps } from '@format.dev/vue'",
		emitSchema ? `import type { ${dataType} } from './data/schema'` : '',
		...application.imports
	])

	const field = firstStringField(data)

	const localType = emitSchema ? '' : `\ntype ${dataType} = ${jsonToTsType(data)}\n`

	const declarations = application.declarations.length > 0 ? `\n${application.declarations.join('\n\n')}\n` : ''

	const titleAttr = field ? `:title="props.data.${field}"` : `title="${titleize(documentName)}"`
	const heading = field ? `{{ props.data.${field} }}` : titleize(documentName)

	const body = buildBody({
		application,
		title: heading,
		hint: starterHint(documentName, 'index.vue'),
		classAttr: cls => ` class="${cls}"`,
		classExprAttr: expr => ` :class="${expr}"`
	})

	const contents = `<script setup lang="ts">
${scriptImports}
${localType}${declarations}
const props = defineProps<RenderProps<${dataType}>>()
</script>

<template>
	<Document ${titleAttr}>
		<Layout :width="${width}" :height="${height}">
${indent(body, 3)}
		</Layout>
	</Document>
</template>
${trailingStyles}`

	return { path: 'index.vue', contents }
}
