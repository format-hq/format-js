import type { GeneratedFile } from '../types.ts'
import type { BuildEntryArgs } from './utils.ts'

import { firstStringField, jsonToTsType } from '../data-schema.ts'

import { pascalCase, dataTypeName, titleize, block, buildBody, starterHint, indent } from './utils.ts'

export function buildReactEntry(args: BuildEntryArgs): GeneratedFile {
	const { documentName, application, width, height, emitSchema, data, empty } = args
	const component = `${pascalCase(documentName)}Document`
	const dataType = dataTypeName(documentName)

	if (empty) {
		const head = block(["import { Document, Layout } from '@format.dev/react'", ...application.imports])

		const contents = `${head}

export default function ${component}() {
	return (
		<Document title="${titleize(documentName)}">
			<Layout width={${width}} height={${height}}>
				{/* Your content goes here */}
			</Layout>
		</Document>
	)
}
`

		return { path: 'index.tsx', contents }
	}

	const head = block([
		"import { Document, Layout, type RenderProps } from '@format.dev/react'",
		emitSchema ? `import type { ${dataType} } from './data/schema'` : '',
		...application.imports
	])

	const field = firstStringField(data)

	// With a schema, the type is inferred from it (per the types docs); otherwise
	// it's declared locally from the sample data.
	const localType = emitSchema ? '' : `\ntype ${dataType} = ${jsonToTsType(data)}\n`

	const declarations = application.declarations.length > 0 ? `\n${application.declarations.join('\n\n')}\n` : ''

	// Render a real string field from the data if there is one, else a literal.
	const titleAttr = field ? `{data.${field}}` : `'${titleize(documentName)}'`
	const heading = field ? `{data.${field}}` : titleize(documentName)

	const body = buildBody({
		application,
		title: heading,
		hint: starterHint(documentName, 'index.tsx'),
		classAttr: cls => ` className="${cls}"`,
		classExprAttr: expr => ` className={${expr}}`
	})

	const contents = `${head}
${localType}${declarations}
export default function ${component}({ data }: RenderProps<${dataType}>) {
	return (
		<Document title=${titleAttr}>
			<Layout width={${width}} height={${height}}>
${indent(body, 4)}
			</Layout>
		</Document>
	)
}
`

	return { path: 'index.tsx', contents }
}
