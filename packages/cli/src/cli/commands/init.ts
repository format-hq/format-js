import type { Framework } from '../../scaffold/shared.ts'
import type { DependencySpec } from '../../scaffold/dependencies.ts'

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'

import pc from 'picocolors'

import { intro, outro, select, confirm, log } from '@clack/prompts'

import { detectIndent } from '../../config.ts'
import { CliError } from '../../errors.ts'
import { requirePrompt, isPromptCancelledError } from '../../prompts.ts'
import { formatDependencyVersion, devOnlyWorkspacePackages, WORKSPACE_VERSION } from '../../scaffold/project.ts'
import { jsVersion } from '../../versioning/js-version.ts'
import { SUPPORTED_FRAMEWORKS } from '../../scaffold/shared.ts'
import { writeDependenciesToManifest } from '../../scaffold/dependencies.ts'
import { finalizeDependencies } from '../../scaffold/finalize-dependencies.ts'
import { getDocumentsDir } from '../../scaffold/document/create-document.ts'
import { RUNTIME_PACKAGES } from './add.ts'
import { newDocumentCommand } from './new-document.ts'

const SCHEMA_URL = 'https://format.dev/schema/format-config.json'
const GITIGNORE_ENTRIES = ['_generated', '.env', 'format-env.d.ts']

// Ambient type declarations for `@format:*` imports. Seeded as a baseline (the
// `@format:*` catch-all resolves to `any`); the compile step regenerates it with
// strongly-typed document exports. Mirrors the next-env.d.ts pattern.
const FORMAT_ENV_TYPES = `/// <reference types="@format.dev/cli/env" />

// This file is managed by Format and regenerated with your document types when
// you compile. Do not edit.
`

export interface InitOptions {
	framework?: string
	rootDir?: string
	yes?: boolean
	install: boolean
	scripts: boolean
	gitignore: boolean
	document: boolean
}

function isFramework(value: string): value is Framework {
	return (SUPPORTED_FRAMEWORKS as readonly string[]).includes(value)
}

interface PackageJsonShape {
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	scripts?: Record<string, string>
}

// An existing react or vue install is the strongest signal for which SDK the
// project wants; neither means an HTML project.
function detectFramework(packageJson: PackageJsonShape): Framework {
	const dependencyNames = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })

	if (dependencyNames.includes('react')) {
		return 'react'
	}

	if (dependencyNames.includes('vue')) {
		return 'vue'
	}

	return 'html'
}

async function resolveFramework(args: {
	provided: string | undefined
	detected: Framework
	skipPrompts: boolean
}): Promise<Framework> {
	const { provided, detected, skipPrompts } = args

	if (provided !== undefined) {
		if (!isFramework(provided)) {
			throw new CliError(`Invalid --framework: "${provided}". Choices: ${SUPPORTED_FRAMEWORKS.join(', ')}.`)
		}

		return provided
	}

	if (skipPrompts) {
		return detected
	}

	return requirePrompt(
		await select<Framework>({
			message: 'How do you want to build your PDFs?',
			initialValue: detected,
			options: [
				{ value: 'html', label: 'HTML' },
				{ value: 'react', label: 'React' },
				{ value: 'vue', label: 'Vue' }
			]
		})
	)
}

async function shouldRun(message: string, skipPrompts: boolean): Promise<boolean> {
	if (skipPrompts) {
		return true
	}

	return requirePrompt(await confirm({ message, initialValue: true }))
}

interface WriteConfigArgs {
	projectDir: string
	framework: Framework
	version: string
	rootDir?: string
}

// The project root is the default, so only write rootDir when it points
// somewhere else. Keeps the config minimal for the common case.
function normalizeRootDir(rootDir: string | undefined): string | undefined {
	if (rootDir === undefined) {
		return undefined
	}

	const trimmed = rootDir.trim()
	const isProjectRoot = trimmed === '' || trimmed === '.' || trimmed === './'

	if (isProjectRoot) {
		return undefined
	}

	return trimmed
}

async function writeFormatConfig(args: WriteConfigArgs): Promise<string> {
	const { projectDir, framework, version, rootDir } = args

	const configPath = join(projectDir, 'format.config.json')
	const config = { $schema: SCHEMA_URL, version, framework, ...(rootDir ? { rootDir } : {}) }

	await fs.writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`, 'utf8')

	return configPath
}

interface AddScriptsResult {
	added: [string, string][]
	renamed: [string, string][]
	// The script name that runs `format dev`, so callers can point the user at
	// the exact command (`dev`, or `format:dev` when `dev` was taken).
	devScriptName: string
}

// Merge the dev/compile scripts into package.json. A taken name gets a
// `format:`-prefixed fallback rather than a silent skip or an overwrite.
async function addPackageScripts(projectDir: string): Promise<AddScriptsResult> {
	const packageJsonPath = join(projectDir, 'package.json')
	const raw = await fs.readFile(packageJsonPath, 'utf8')
	const packageJson = JSON.parse(raw) as PackageJsonShape & Record<string, unknown>
	const scripts = { ...(packageJson.scripts ?? {}) }

	const wanted: [string, string][] = [
		['dev', 'format dev'],
		['compile', 'format compile']
	]

	const added: [string, string][] = []
	const renamed: [string, string][] = []
	const resolvedName: Record<string, string> = {}

	for (const [name, command] of wanted) {
		if (scripts[name] === command) {
			resolvedName[name] = name

			continue
		}

		if (scripts[`format:${name}`] === command) {
			resolvedName[name] = `format:${name}`

			continue
		}

		if (scripts[name] === undefined) {
			scripts[name] = command
			added.push([name, command])
			resolvedName[name] = name

			continue
		}

		scripts[`format:${name}`] = command
		renamed.push([`format:${name}`, command])
		resolvedName[name] = `format:${name}`
	}

	if (added.length > 0 || renamed.length > 0) {
		packageJson.scripts = scripts
		const indent = detectIndent(raw)
		await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, indent)}\n`, 'utf8')
	}

	return { added, renamed, devScriptName: resolvedName.dev }
}

// Append the entries Format needs to .gitignore, creating it when absent.
// Never removes or reorders what's already there.
async function updateGitignore(projectDir: string): Promise<string[]> {
	const gitignorePath = join(projectDir, '.gitignore')
	const existing = existsSync(gitignorePath) ? await fs.readFile(gitignorePath, 'utf8') : ''
	const lines = existing.split('\n').map(line => line.trim())

	const missing = GITIGNORE_ENTRIES.filter(entry => !lines.includes(entry))

	if (missing.length === 0) {
		return []
	}

	const separator = existing === '' || existing.endsWith('\n') ? '' : '\n'
	await fs.writeFile(gitignorePath, `${existing}${separator}${missing.join('\n')}\n`, 'utf8')

	return missing
}

function packagesForFramework(framework: Framework): string[] {
	if (framework === 'react') {
		return ['@format.dev/react', '@format.dev/client']
	}

	if (framework === 'vue') {
		return ['@format.dev/vue', '@format.dev/client']
	}

	return ['@format.dev/client']
}

// The Format packages a project needs, at the pinned lockstep version. Runtime
// packages go in dependencies; the SDKs are devDependencies (authoring-time).
function formatDependencySpecs(framework: Framework, version: string): DependencySpec[] {
	const dependencyVersion = formatDependencyVersion(version)

	const packages = packagesForFramework(framework).map(name => ({
		name,
		version: dependencyVersion,
		dev: !RUNTIME_PACKAGES.includes(name)
	}))

	const linked = devOnlyWorkspacePackages().map(name => ({ name, version: WORKSPACE_VERSION, dev: true }))

	return [...packages, ...linked]
}

// Bootstrap Format into an existing project: config with the pinned version,
// npm scripts, gitignore entries, packages at the pin, and optionally a first
// document. The version is the CLI's own — all Format packages release in
// lockstep, so the CLI the user just ran IS the release they get.
export async function initCommand(cwd: string, options: InitOptions): Promise<number> {
	const skipPrompts = options.yes === true

	const configPath = join(cwd, 'format.config.json')
	const configPathJsonc = join(cwd, 'format.config.jsonc')

	if (existsSync(configPath) || existsSync(configPathJsonc)) {
		throw new CliError('This project is already set up: a format.config file exists here.')
	}

	const packageJsonPath = join(cwd, 'package.json')

	if (!existsSync(packageJsonPath)) {
		throw new CliError(
			'No package.json found. Run `format init` in the root of an existing project, or start fresh with `npm create format`.'
		)
	}

	try {
		intro(pc.bgCyan(pc.black(' Format ')))

		const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as PackageJsonShape

		const framework = await resolveFramework({
			provided: options.framework,
			detected: detectFramework(packageJson),
			skipPrompts
		})

		const version = jsVersion
		const rootDir = normalizeRootDir(options.rootDir)
		await writeFormatConfig({ projectDir: cwd, framework, version, rootDir })

		// Create the documents directory now, so the project has its shape even
		// before a first document is scaffolded.
		const documentsDir = getDocumentsDir({ projectRoot: cwd, config: { framework, rootDir } })
		await fs.mkdir(documentsDir, { recursive: true })
		const documentsPath = relative(cwd, documentsDir)

		// Seed the ambient types at the repo root so `@format:*` imports resolve
		// right after init. Compile regenerates it with strong document types.
		await fs.writeFile(join(cwd, 'format-env.d.ts'), FORMAT_ENV_TYPES, 'utf8')

		const configLine = `Created ${pc.cyan('format.config.json')} ${pc.dim(`(Format ${version}, ${framework})`)}`
		log.success(`${configLine}\n${pc.dim(`Documents directory: ${documentsPath}`)}`)

		let devScriptName: string | undefined

		if (options.scripts && (await shouldRun('Add format npm scripts to package.json?', skipPrompts))) {
			const { added, renamed, devScriptName: resolvedDevScript } = await addPackageScripts(cwd)
			devScriptName = resolvedDevScript

			const scriptLines = [...added, ...renamed].map(([name, command]) => `${pc.cyan(name)}: ${pc.dim(command)}`)

			if (renamed.length > 0) {
				scriptLines.push(pc.dim('Some script names were taken, so those use a format: prefix.'))
			}

			log.success(`Added npm scripts\n${scriptLines.join('\n')}`)
		}

		if (options.gitignore && (await shouldRun('Update .gitignore?', skipPrompts))) {
			const appended = await updateGitignore(cwd)

			if (appended.length > 0) {
				log.success(`Added to .gitignore: ${pc.dim(appended.join(', '))}`)
			}
		}

		// Always record the Format packages in package.json at the pin. Whether to
		// run the install is a single decision, taken at the end of the flow.
		const formatDependencies = formatDependencySpecs(framework, version)
		const addedFormatPackages = await writeDependenciesToManifest({ projectDir: cwd, dependencies: formatDependencies })

		const createDocumentNow = options.document && (await shouldRun('Create your first document?', skipPrompts))

		if (createDocumentNow) {
			// The document flow is the last step, so it owns the single install
			// prompt — listing the Format packages we just added alongside any
			// styling or schema libraries the document needs. It runs embedded, so
			// it renders inside this flow's gutter rather than opening its own.
			const exitCode = await newDocumentCommand(cwd, undefined, {
				yes: options.yes,
				install: options.install,
				embedded: true,
				incomingDependencies: addedFormatPackages
			})

			if (exitCode !== 0) {
				return exitCode
			}
		}

		if (!createDocumentNow) {
			// Keep the empty documents directory in version control until the first
			// document lands.
			await fs.writeFile(join(documentsDir, '.gitkeep'), '', 'utf8')

			await finalizeDependencies({
				projectDir: cwd,
				addedDependencies: addedFormatPackages,
				install: options.install ? undefined : false,
				skipPrompts
			})
		}

		const startCommand = devScriptName ? `npm run ${devScriptName}` : 'format dev'
		outro(`Format is set up. Start Studio with ${pc.cyan(startCommand)}`)

		return 0
	} catch (error) {
		if (isPromptCancelledError(error)) {
			return 0
		}

		throw error
	}
}
