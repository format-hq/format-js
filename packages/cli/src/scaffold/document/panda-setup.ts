import type { PackageManager } from '../../package-manager.ts'

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'

import { modify, applyEdits } from 'jsonc-parser'

import { commandForPlatform, detectPackageManager } from '../../package-manager.ts'

// Panda config filenames, in the order Panda itself resolves them.
const PANDA_CONFIG_NAMES = [
	'panda.config.ts',
	'panda.config.mts',
	'panda.config.cts',
	'panda.config.js',
	'panda.config.mjs',
	'panda.config.cjs'
]

// The default Panda config Format looks for (see stylesPreProcessor). When the
// project's config lives here, no `configPath` override is needed.
const DEFAULT_PANDA_CONFIG_NAME = 'panda.config.ts'

const PANDA_CONFIG_TEMPLATE = (documentsDirName: string) => `import { defineConfig } from '@pandacss/dev'

export default defineConfig({
	include: ['./${documentsDirName}/**/*.{js,jsx,ts,tsx,vue}'],
	outdir: './styles/styled-system'
})
`

// Walk up from the project root looking for an existing Panda config, so we never
// clobber one the user already has (even in a parent of a monorepo package).
export function findExistingPandaConfig(projectRoot: string): string | null {
	let dir = resolve(projectRoot)

	for (;;) {
		for (const name of PANDA_CONFIG_NAMES) {
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

interface WritePandaConfigArgs {
	projectRoot: string
	documentsDirName: string
}

// Write a starter panda.config.ts at the project root. Only called when no config
// was found, so it never overwrites the user's own.
export async function writePandaConfig(args: WritePandaConfigArgs): Promise<string> {
	const { projectRoot, documentsDirName } = args
	const configPath = join(projectRoot, DEFAULT_PANDA_CONFIG_NAME)

	await fs.writeFile(configPath, PANDA_CONFIG_TEMPLATE(documentsDirName), 'utf8')
	return configPath
}

// The Panda layer stylesheet the document entry imports. Declares Panda's cascade
// layers and centres the page host (which `css()` classes can't target).
const PANDA_LAYER_CSS = `@layer reset, base, tokens, recipes, utilities;

:host {
	display: flex;
	flex-direction: column;
	justify-content: center;
	text-align: center;
}
`

// Ensure `styles/styles.css` exists for the entry to import. Never overwrites an
// existing file, so a user's own layer setup is left alone.
export async function ensurePandaLayerCss(projectRoot: string): Promise<'created' | 'exists'> {
	const stylesDir = join(projectRoot, 'styles')
	const layerPath = join(stylesDir, 'styles.css')

	if (existsSync(layerPath)) {
		return 'exists'
	}

	await fs.mkdir(stylesDir, { recursive: true })
	await fs.writeFile(layerPath, PANDA_LAYER_CSS, 'utf8')

	return 'created'
}

export type PrepareScriptResult = 'added' | 'exists' | 'no-package-json'

// Detect the indentation of an existing JSON file so a rewrite preserves it.
function detectIndent(raw: string): string {
	const match = raw.match(/^[ \t]+/m)
	return match ? match[0] : '\t'
}

// Add `"prepare": "panda codegen"` so `panda codegen` runs on every install. Left
// untouched when the project already defines a prepare script.
export async function addPrepareScript(projectRoot: string): Promise<PrepareScriptResult> {
	const packageJsonPath = join(projectRoot, 'package.json')

	let raw: string
	try {
		raw = await fs.readFile(packageJsonPath, 'utf8')
	} catch {
		return 'no-package-json'
	}

	const packageJson = JSON.parse(raw) as { scripts?: Record<string, string> }

	if (packageJson.scripts?.prepare) {
		return 'exists'
	}

	packageJson.scripts = { ...packageJson.scripts, prepare: 'panda codegen' }

	const indent = detectIndent(raw)
	await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, indent)}\n`, 'utf8')

	return 'added'
}

interface EnablePandaInFormatConfigArgs {
	formatConfigPath: string
	projectRoot: string
	pandaConfigPath: string
}

// Turn on `pandaCss` in the user's format.config.json, using jsonc-parser edits
// so their comments and formatting survive. A `configPath` override is only
// written when the Panda config isn't at the default location Format already
// looks for.
export async function enablePandaInFormatConfig(args: EnablePandaInFormatConfigArgs): Promise<void> {
	const { formatConfigPath, projectRoot, pandaConfigPath } = args

	const raw = await fs.readFile(formatConfigPath, 'utf8')

	const indent = detectIndent(raw)
	const formattingOptions = {
		insertSpaces: !indent.includes('\t'),
		tabSize: indent.includes('\t') ? 4 : indent.length
	}

	const applyConfigEdit = (content: string, path: (string | number)[], value: unknown) => {
		const edits = modify(content, path, value, { formattingOptions })

		return applyEdits(content, edits)
	}

	let updated = applyConfigEdit(raw, ['pandaCss', 'enabled'], true)

	const isDefaultLocation = resolve(pandaConfigPath) === resolve(projectRoot, DEFAULT_PANDA_CONFIG_NAME)

	if (!isDefaultLocation) {
		const relativeConfig = `./${relative(projectRoot, pandaConfigPath)}`
		const relativeCwd = `./${relative(projectRoot, dirname(pandaConfigPath))}`

		updated = applyConfigEdit(updated, ['pandaCss', 'postCssConfig'], { cwd: relativeCwd, configPath: relativeConfig })
	}

	await fs.writeFile(formatConfigPath, updated, 'utf8')
}

export interface CodegenResult {
	ok: boolean
	message?: string
}

function execArgs(packageManager: PackageManager, binArgs: string[]): { command: string; args: string[] } {
	switch (packageManager) {
		case 'pnpm':
			return { command: 'pnpm', args: ['exec', ...binArgs] }
		case 'yarn':
			return { command: 'yarn', args: ['exec', ...binArgs] }
		case 'bun':
			return { command: 'bun', args: ['x', ...binArgs] }
		default:
			return { command: 'npm', args: ['exec', '--', ...binArgs] }
	}
}

// Run `panda codegen` in the user's project so the generated `styled-system` is
// ready before the first render. Resolves (never rejects) with a status.
export async function runPandaCodegen(projectRoot: string): Promise<CodegenResult> {
	const packageManager = await detectPackageManager(projectRoot)
	const { command, args } = execArgs(packageManager, ['panda', 'codegen'])

	return new Promise<CodegenResult>(resolvePromise => {
		const child = spawn(commandForPlatform(command), args, { cwd: projectRoot, stdio: 'inherit', shell: false })

		child.on('error', error => {
			resolvePromise({ ok: false, message: error.message })
		})

		child.on('exit', code => {
			resolvePromise(code === 0 ? { ok: true } : { ok: false, message: `panda codegen exited with code ${code}` })
		})
	})
}

export interface PandaSetupResult {
	pandaConfigPath: string
	pandaConfigCreated: boolean
	layerCss: 'created' | 'exists'
	prepareScript: PrepareScriptResult
	formatConfigUpdated: boolean
	codegen: CodegenResult
}

export interface SetupPandaArgs {
	projectRoot: string
	documentsDirName: string
	formatConfigPath: string
	// Injectable so tests don't shell out; defaults to the real codegen run.
	runCodegen?: (projectRoot: string) => Promise<CodegenResult>
}

// Orchestrates the idempotent Panda project setup: find-or-create the config, add
// the prepare script, enable Panda in the Format config, then run codegen.
export async function setupPanda(args: SetupPandaArgs): Promise<PandaSetupResult> {
	const { projectRoot, documentsDirName, formatConfigPath, runCodegen = runPandaCodegen } = args

	const existing = findExistingPandaConfig(projectRoot)
	const pandaConfigCreated = existing === null
	const pandaConfigPath = existing ?? (await writePandaConfig({ projectRoot, documentsDirName }))

	const layerCss = await ensurePandaLayerCss(projectRoot)
	const prepareScript = await addPrepareScript(projectRoot)

	let formatConfigUpdated = false
	try {
		await enablePandaInFormatConfig({ formatConfigPath, projectRoot, pandaConfigPath })
		formatConfigUpdated = true
	} catch {
		// A config we can't safely edit (unusual shape) shouldn't fail the whole
		// document create — the modal still tells the user what's left to do.
		formatConfigUpdated = false
	}

	const codegen = await runCodegen(projectRoot)

	return { pandaConfigPath, pandaConfigCreated, layerCss, prepareScript, formatConfigUpdated, codegen }
}
