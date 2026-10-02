import type { ParseError } from 'jsonc-parser'

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parse as parseJsonc, modify, applyEdits, printParseErrorCode } from 'jsonc-parser'

import { CliError } from './errors.ts'

export const DEFAULT_CONFIG_BASE_NAME = 'format.config'
export const CONFIG_EXTENSIONS = ['json', 'jsonc']

export interface FormatConfigFile {
	filepath: string
	config: Record<string, unknown>
	raw: string
}

interface FindConfigPathOptions {
	// Studio's tests point at fixture configs via the FMT_CONFIG_FILE_NAME env
	// var, so the base name is overridable; everything else uses the default.
	baseName?: string
}

// Locate the Format config file, searching up from startDir so commands work
// from any subdirectory of a project (and a monorepo root pin is found).
export function findConfigPath(startDir: string, options?: FindConfigPathOptions): string | null {
	const baseName = options?.baseName ?? DEFAULT_CONFIG_BASE_NAME
	const names = CONFIG_EXTENSIONS.map(extension => `${baseName}.${extension}`)
	let dir = resolve(startDir)

	for (;;) {
		for (const name of names) {
			const candidate = join(dir, name)

			if (existsSync(candidate)) {
				return candidate
			}
		}

		const parent = dirname(dir)

		if (parent === dir) {
			return null
		}

		dir = parent
	}
}

export async function readConfigFile(filepath: string): Promise<FormatConfigFile> {
	const raw = await fs.readFile(filepath, 'utf8')
	const errors: ParseError[] = []
	const config = parseJsonc(raw, errors, { allowTrailingComma: true })

	if (errors.length > 0) {
		const details = errors
			.map(error => {
				const line = raw.slice(0, error.offset).split('\n').length

				return `${printParseErrorCode(error.error)} at line ${line}`
			})
			.join(', ')

		throw new CliError(`Could not parse ${filepath}: ${details}`)
	}

	const isNotAnObject = typeof config !== 'object' || config === null || Array.isArray(config)

	if (isNotAnObject) {
		throw new CliError(`Invalid Format config in ${filepath}: expected a JSON object.`)
	}

	return { filepath, config: config as Record<string, unknown>, raw }
}

interface WriteConfigVersionArgs {
	filepath: string
	version: string
}

// Rewrite the version field in place, preserving comments and formatting.
export async function writeConfigVersion(args: WriteConfigVersionArgs): Promise<void> {
	const { filepath, version } = args

	const raw = await fs.readFile(filepath, 'utf8')
	const indent = detectIndent(raw)
	const edits = modify(raw, ['version'], version, {
		formattingOptions: {
			insertSpaces: !indent.includes('\t'),
			tabSize: indent.includes('\t') ? 4 : indent.length
		}
	})

	await fs.writeFile(filepath, applyEdits(raw, edits), 'utf8')
}

export function detectIndent(raw: string): string {
	const match = raw.match(/^[ \t]+/m)

	return match ? match[0] : '\t'
}
