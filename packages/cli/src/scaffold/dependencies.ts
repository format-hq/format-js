import type { PackageManager } from '../package-manager.ts'

import fs from 'node:fs/promises'
import { join } from 'node:path'

import { detectIndent } from '../config.ts'
import { detectPackageManager, installCommand } from '../package-manager.ts'
import { runInstall } from './run-install.ts'

export interface DependencySpec {
	name: string
	version: string
	dev: boolean
}

interface PackageJsonShape {
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	[key: string]: unknown
}

// Merge dependencies into package.json without installing anything. A name
// already present in either section is left untouched — we never downgrade or
// overwrite a version the user already chose. Returns the names actually added,
// in input order, so a caller can report exactly what changed.
export async function writeDependenciesToManifest(args: {
	projectDir: string
	dependencies: DependencySpec[]
}): Promise<string[]> {
	const { projectDir, dependencies } = args

	if (dependencies.length === 0) {
		return []
	}

	const packageJsonPath = join(projectDir, 'package.json')
	const raw = await fs.readFile(packageJsonPath, 'utf8')
	const packageJson = JSON.parse(raw) as PackageJsonShape

	const runtime = { ...(packageJson.dependencies ?? {}) }
	const development = { ...(packageJson.devDependencies ?? {}) }
	const present = new Set([...Object.keys(runtime), ...Object.keys(development)])

	const added: string[] = []

	for (const dependency of dependencies) {
		if (present.has(dependency.name)) {
			continue
		}

		const target = dependency.dev ? development : runtime
		target[dependency.name] = dependency.version
		present.add(dependency.name)
		added.push(dependency.name)
	}

	if (added.length === 0) {
		return []
	}

	if (Object.keys(runtime).length > 0) {
		packageJson.dependencies = runtime
	}

	if (Object.keys(development).length > 0) {
		packageJson.devDependencies = development
	}

	const indent = detectIndent(raw)
	await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, indent)}\n`, 'utf8')

	return added
}

export interface InstallResult {
	ok: boolean
	packageManager: PackageManager
	message?: string
	output?: string
}

export interface InstallManifestArgs {
	projectDir: string
	onProgress?: (line: string) => void
}

// Install everything in package.json with the project's package manager. This
// installs the whole manifest (not named packages), so a single run picks up
// every dependency written across a scaffold flow.
export async function installManifest(args: InstallManifestArgs): Promise<InstallResult> {
	const { projectDir, onProgress } = args
	const packageManager = await detectPackageManager(projectDir)
	const { command, args: commandArgs } = installCommand(packageManager)

	const result = await runInstall({ command, args: commandArgs, cwd: projectDir, onProgress })

	if (result.ok) {
		return { ok: true, packageManager }
	}

	return {
		ok: false,
		packageManager,
		message: result.error?.message ?? `${packageManager} exited with code ${result.code}`,
		output: result.output
	}
}

// "a", "a and b", "a, b and c" — for listing added packages in a sentence.
export function joinNames(names: string[]): string {
	if (names.length <= 1) {
		return names[0] ?? ''
	}

	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
