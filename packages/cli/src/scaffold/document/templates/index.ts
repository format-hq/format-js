import type { SchemaKind } from '../../shared.ts'
import type { GeneratedFile } from '../types.ts'
import type { BuildEntryArgs } from './utils.ts'

import { DEFAULT_SCHEMA_KIND } from '../../shared.ts'
import { buildReactEntry } from './react.ts'
import { buildVueEntry } from './vue.ts'
import { buildHtmlEntry } from './html.ts'
import { dataTypeName } from './utils.ts'
import { jsonToSchemaExpr, jsonToTsType } from '../data-schema.ts'

// Dispatch to the per-framework entry builder. Each builder lives in its own
// module under templates/, with the shared helpers in templates/utils.ts.
export function buildEntryFiles(args: BuildEntryArgs): GeneratedFile[] {
	const { framework } = args

	if (framework === 'vue') {
		return [buildVueEntry(args)]
	}

	if (framework === 'html') {
		return buildHtmlEntry(args)
	}

	return [buildReactEntry(args)]
}

export function buildDataFile(data: unknown): GeneratedFile {
	const contents = `${JSON.stringify(data, null, '\t')}\n`
	return { path: 'data/default.json', contents }
}

// The import line and the inferred-type export differ per library. Zod, Valibot,
// and Yup infer the type straight from the schema (the pattern the types docs
// recommend); Joi has no static inference, so its type is written out from the
// same data shape instead.
const SCHEMA_HEADER: Record<SchemaKind, string> = {
	zod: "import { z } from 'zod'",
	valibot: "import * as v from 'valibot'",
	yup: "import * as yup from 'yup'",
	joi: "import Joi from 'joi'"
}

function schemaTypeExport(kind: SchemaKind, typeName: string, data: unknown): string {
	if (kind === 'zod') {
		return `export type ${typeName} = z.infer<typeof schema>`
	}

	if (kind === 'valibot') {
		return `export type ${typeName} = v.InferOutput<typeof schema>`
	}

	if (kind === 'yup') {
		return `export type ${typeName} = yup.InferType<typeof schema>`
	}

	return `export type ${typeName} = ${jsonToTsType(data)}`
}

// Emit `data/schema.ts`: a schema inferred from the sample data plus a type the
// entry file imports. Every library exposes the Standard Schema `~standard`
// interface (joi >= 18, yup >= 1.4), which is what Format validates data against.
export function buildSchemaFile(
	documentName: string,
	kind: SchemaKind = DEFAULT_SCHEMA_KIND,
	data: unknown
): GeneratedFile {
	const typeName = dataTypeName(documentName)
	const schemaExpr = jsonToSchemaExpr(data, kind)

	const contents = `${SCHEMA_HEADER[kind]}

const schema = ${schemaExpr}

export default schema

${schemaTypeExport(kind, typeName, data)}
`

	return { path: 'data/schema.ts', contents }
}

export function buildGitkeepFile(): GeneratedFile {
	return { path: 'assets/.gitkeep', contents: '' }
}
