// Generates schema/format-config.json from the FormatConfig interface. The
// interface (and its JSDoc) is the source of truth; the schema is a build
// artefact consumed by editors via the $schema field in format.config.json.
// Run via `pnpm generate:schema`.
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenerator } from 'ts-json-schema-generator'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const generator = createGenerator({
	path: resolve(root, 'src/shared/types/public/config.ts'),
	tsconfig: resolve(root, 'tsconfig.json'),
	type: 'FormatConfig',
	topRef: false,
	additionalProperties: false
})

const schema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	title: 'Format config',
	...generator.createSchema('FormatConfig')
}

// The canonical copy lives in this package (compile owns the config type). The
// second copy is apps/web's public dir, served at format.dev/schema/format-config.json
// — the URL consumer configs reference in their $schema field. That copy is
// written only when apps/web is present, so the generator still works from a
// standalone checkout of this package that has no monorepo siblings.
const webPublicSchema = resolve(root, '../../apps/web/public/schema/format-config.json')

const outPaths = [resolve(root, 'schema/format-config.json')]

if (existsSync(dirname(dirname(webPublicSchema)))) {
	outPaths.push(webPublicSchema)
}

for (const outPath of outPaths) {
	await mkdir(dirname(outPath), { recursive: true })
	await writeFile(outPath, `${JSON.stringify(schema, null, '\t')}\n`, 'utf8')

	console.log(`Wrote ${outPath}`)
}
