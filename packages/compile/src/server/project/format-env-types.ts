import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const FORMAT_ENV_FILE_NAME = 'format-env.d.ts'

export interface TypedDocument {
	exportName: string
}

// The strongly-typed declaration for one virtual module alias. The FormatRenderer
// shape is inlined so the generated file is self-contained — it needs no imports.
function buildDocumentModuleTypes(alias: string, documents: TypedDocument[]): string {
	const exportNames = documents.map(document => document.exportName)

	const namedExports = exportNames.map(name => `\texport const ${name}: FormatRenderer`).join('\n')

	const defaultShape = exportNames.map(name => `${name}: FormatRenderer`).join('; ')

	return [
		`declare module '${alias}' {`,
		'\tinterface FormatAssetConfig {',
		'\t\tgetAssetsUrl(): string | undefined',
		'\t\tsetAssetsUrl(url: string): void',
		'\t}',
		'',
		'\tinterface FormatDocument {',
		'\t\thtml: string',
		'\t\tgetAssetsWebStream(): Promise<ReadableStream<Uint8Array> | undefined>',
		'\t}',
		'',
		'\tinterface FormatRenderer extends FormatAssetConfig {',
		'\t\trender(data?: Record<string, unknown>): Promise<FormatDocument>',
		'\t\tgetAssetsWebStream(): Promise<ReadableStream<Uint8Array> | undefined>',
		'\t}',
		'',
		namedExports,
		'',
		`\tconst renderers: { ${defaultShape}; [key: string]: FormatRenderer }`,
		'\texport default renderers',
		'}'
	].join('\n')
}

interface BuildFormatEnvSourceArgs {
	aliases: string[]
	documents: TypedDocument[]
}

// The full contents of a project's format-env.d.ts: the base ambient reference
// (which resolves `*.html`, `*.svg`, and the `@format:*` catch-all) plus a
// strongly-typed module for each compiled alias. `format init` seeds the base
// reference alone; compile regenerates the file with these typed modules.
export function buildFormatEnvSource(args: BuildFormatEnvSourceArgs): string {
	const { aliases, documents } = args

	const modules = aliases.map(alias => buildDocumentModuleTypes(alias, documents)).join('\n\n')

	return `/// <reference types="@format.dev/cli/env" />

// This file is managed by Format and regenerated with your document types when
// you compile. Do not edit.

${modules}
`
}

interface WriteFormatEnvTypesArgs {
	projectRoot: string
	aliases: string[]
	documents: TypedDocument[]
}

// Write <projectRoot>/format-env.d.ts, skipping the write when nothing changed
// so repeated compiles don't churn the file (or the watcher that sees it).
export async function writeFormatEnvTypes(args: WriteFormatEnvTypesArgs): Promise<void> {
	const { projectRoot, aliases, documents } = args

	const target = join(projectRoot, FORMAT_ENV_FILE_NAME)
	const source = buildFormatEnvSource({ aliases, documents })

	const existing = await readExisting(target)

	if (existing === source) {
		return
	}

	await writeFile(target, source, 'utf8')
}

async function readExisting(path: string): Promise<string | null> {
	try {
		return await readFile(path, 'utf8')
	} catch {
		return null
	}
}
