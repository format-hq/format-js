import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CliError } from '../errors.ts'
import { jsVersion } from '../versioning/js-version.ts'
import { installCommand } from '../package-manager.ts'
import { STUDIO_PACKAGE, COMPILE_PACKAGE } from '../studio.ts'
import { runInstall } from './run-install.ts'

import type { PackageManager } from '../package-manager.ts'
import type { Framework } from './shared.ts'

// 'dev' keeps workspace:* deps (scaffolds only installable inside this repo's
// workspace); 'prod' pins every @format.dev/* dep to the CLI's own version — the
// lockstep release version. Baked in by tsdown (see tsdown.config*.ts).
type BuildMode = 'dev' | 'prod'

export function getBuildMode(): BuildMode {
	return process.env.FORMAT_CLI_MODE === 'prod' ? 'prod' : 'dev'
}

export const WORKSPACE_VERSION = 'workspace:*'

// The specifier to write for an @format.dev/* dependency. A dev build's packages
// aren't published at the CLI's version, so they can only resolve by link
// inside this monorepo; a prod build pins the released version exactly. The
// config's `version` field is written in both modes regardless — it drives
// Studio's lockstep and engine checks, and drift detection skips workspace
// specifiers.
export function formatDependencyVersion(version: string): string {
	return getBuildMode() === 'prod' ? version : WORKSPACE_VERSION
}

// Studio and compile are never project dependencies in a released setup: the
// CLI fetches the pinned version with `npm exec` when a subcommand needs one.
// A dev build has nothing to fetch — neither package is published at the CLI's
// version — so a scaffold links them from the monorepo instead, which is also
// what findLocalStudio looks for before it reaches for the registry.
export function devOnlyWorkspacePackages(): string[] {
	if (getBuildMode() === 'prod') {
		return []
	}

	return [STUDIO_PACKAGE, COMPILE_PACKAGE]
}

const _dirname = dirname(fileURLToPath(import.meta.url))

// Walk up from this module to the CLI's own package.json. Works from dist
// (published layout) and from src (tests, tsx).
function findCliPackageRoot(): string {
	let dir = _dirname

	for (;;) {
		const candidate = join(dir, 'package.json')

		if (existsSync(candidate)) {
			return dir
		}

		const parent = dirname(dir)

		if (parent === dir) {
			throw new CliError('Could not locate the @format.dev/cli package root.')
		}

		dir = parent
	}
}

// npm strips .gitignore (and other dotfiles) from published tarballs, so the
// templates ship them underscore-prefixed and they're renamed after the copy —
// the same convention create-vite uses.
const DOTFILE_TEMPLATES: Record<string, string> = {
	_gitignore: '.gitignore',
	_env: '.env'
}

async function restoreDotfiles(dirPath: string): Promise<void> {
	for (const [templateName, dotfileName] of Object.entries(DOTFILE_TEMPLATES)) {
		const templateFile = join(dirPath, templateName)

		if (existsSync(templateFile)) {
			await fs.rename(templateFile, join(dirPath, dotfileName))
		}
	}
}

export function resolveTemplatePath(name: string): string {
	const templatePath = join(findCliPackageRoot(), 'templates', name)

	if (!existsSync(templatePath)) {
		throw new CliError(`Unknown project template "${name}".`)
	}

	return templatePath
}

export function deriveProjectName(dirInput: string): string {
	const withoutTrailingSlashes = dirInput.trim().replace(/[\\/]+$/, '')
	const name = basename(withoutTrailingSlashes)

	return name === '' || name === '.' ? 'my-format-project' : name
}

// All public Format packages release in lockstep, so the CLI's own version is
// the published version of every @format.dev/* dependency.
function replaceWorkspaceVersions(
	deps: Record<string, string> | undefined,
	version: string
): Record<string, string> | undefined {
	if (!deps) {
		return deps
	}

	for (const [depName, depVersion] of Object.entries(deps)) {
		const isReplaceable = depVersion === 'workspace:*' && depName.startsWith('@format.dev/')

		if (isReplaceable) {
			deps[depName] = version
		}
	}

	return deps
}

interface PackageJsonShape {
	name?: string
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
}

interface UpdateGeneratedPackageJsonArgs {
	dirPath: string
	projectName: string
	buildMode: BuildMode
	version: string
}

async function updateGeneratedPackageJson(args: UpdateGeneratedPackageJsonArgs): Promise<void> {
	const { dirPath, projectName, buildMode, version } = args

	const packageJsonPath = resolve(dirPath, 'package.json')
	const raw = await fs.readFile(packageJsonPath, 'utf8')
	const packageJson = JSON.parse(raw) as PackageJsonShape

	packageJson.name = projectName

	for (const name of devOnlyWorkspacePackages()) {
		packageJson.devDependencies = { ...packageJson.devDependencies, [name]: WORKSPACE_VERSION }
	}

	if (buildMode === 'prod') {
		packageJson.dependencies = replaceWorkspaceVersions(packageJson.dependencies, version)
		packageJson.devDependencies = replaceWorkspaceVersions(packageJson.devDependencies, version)
		packageJson.optionalDependencies = replaceWorkspaceVersions(packageJson.optionalDependencies, version)
		packageJson.peerDependencies = replaceWorkspaceVersions(packageJson.peerDependencies, version)
	}

	await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, '\t')}\n`, 'utf8')
}

interface UpdateGeneratedFormatConfigArgs {
	dirPath: string
	version: string
}

// Stamp the pinned Format version into the scaffolded format.config.json. The
// field is required by the config schema and Studio refuses to start without
// it, so it is written in both build modes — matching `format init`. A dev
// scaffold's workspace deps don't conflict with a pin: findMismatches skips
// `workspace:` entries, which resolve by link rather than by number.
async function updateGeneratedFormatConfig(args: UpdateGeneratedFormatConfigArgs): Promise<void> {
	const { dirPath, version } = args

	const configPath = resolve(dirPath, 'format.config.json')
	const raw = await fs.readFile(configPath, 'utf8')
	const config = JSON.parse(raw) as Record<string, unknown>

	const withVersion = {
		$schema: config.$schema,
		version,
		...config
	}

	await fs.writeFile(configPath, `${JSON.stringify(withVersion, null, '\t')}\n`, 'utf8')
}

function isCommandNotFoundError(error: Error | undefined): boolean {
	return !!(error && 'code' in error && error.code === 'ENOENT')
}

export interface InstallProjectResult {
	ok: boolean
	packageManagerUsed: PackageManager
	fellBackToNpm: boolean
	message?: string
	output?: string
}

export interface InstallProjectArgs {
	dirPath: string
	preferredPackageManager: PackageManager
	onProgress?: (line: string) => void
}

export async function installProjectDependencies(args: InstallProjectArgs): Promise<InstallProjectResult> {
	const { dirPath, preferredPackageManager, onProgress } = args

	const attempt = async (packageManager: PackageManager) => {
		const { command, args: commandArgs } = installCommand(packageManager)

		return runInstall({ command, args: commandArgs, cwd: dirPath, onProgress })
	}

	const first = await attempt(preferredPackageManager)

	if (first.ok) {
		return { ok: true, packageManagerUsed: preferredPackageManager, fellBackToNpm: false }
	}

	const canFallBack = preferredPackageManager !== 'npm' && isCommandNotFoundError(first.error)

	if (!canFallBack) {
		return {
			ok: false,
			packageManagerUsed: preferredPackageManager,
			fellBackToNpm: false,
			message: first.error?.message ?? `${preferredPackageManager} exited with code ${first.code}`,
			output: first.output
		}
	}

	const fallback = await attempt('npm')

	if (fallback.ok) {
		return { ok: true, packageManagerUsed: 'npm', fellBackToNpm: true }
	}

	return {
		ok: false,
		packageManagerUsed: 'npm',
		fellBackToNpm: true,
		message: fallback.error?.message ?? `npm exited with code ${fallback.code}`,
		output: fallback.output
	}
}

export async function templateUsesWorkspaceDeps(dirPath: string): Promise<boolean> {
	try {
		const packageJson = await fs.readFile(resolve(dirPath, 'package.json'), 'utf8')

		return packageJson.includes('workspace:')
	} catch {
		return false
	}
}

export interface ScaffoldProjectArgs {
	directory: string
	framework: Framework
	cwd: string
}

export interface ScaffoldProjectResult {
	dirPath: string
	projectName: string
}

// Copy the shared and framework templates into the target directory, then
// stamp the project name, the lockstep dependency versions, and the pinned
// Format version.
export async function scaffoldProject(args: ScaffoldProjectArgs): Promise<ScaffoldProjectResult> {
	const { directory, framework, cwd } = args

	const dirPath = resolve(cwd, directory)
	const projectName = deriveProjectName(directory)
	const buildMode = getBuildMode()
	const version = jsVersion

	await fs.mkdir(dirPath, { recursive: true })

	try {
		const sharedPath = resolveTemplatePath('shared')
		await fs.cp(sharedPath, dirPath, { recursive: true })
	} catch {
		// No shared template files — nothing to copy.
	}

	const templatePath = resolveTemplatePath(framework)
	await fs.cp(templatePath, dirPath, { recursive: true })

	await restoreDotfiles(dirPath)

	await updateGeneratedPackageJson({ dirPath, projectName, buildMode, version })
	await updateGeneratedFormatConfig({ dirPath, version })

	return { dirPath, projectName }
}
