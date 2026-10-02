import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { detectIndent } from '../config.ts'

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const

type DependencySection = (typeof DEPENDENCY_SECTIONS)[number]

export interface FormatDependency {
	name: string
	section: DependencySection
	version: string
}

interface PackageJsonShape {
	[key: string]: unknown
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
}

// The config file sits next to package.json by convention, so the project's
// package.json is looked for in the config file's directory.
export function packageJsonPathFor(configPath: string): string | null {
	const candidate = join(dirname(configPath), 'package.json')

	return existsSync(candidate) ? candidate : null
}

export async function scanFormatDependencies(packageJsonPath: string): Promise<FormatDependency[]> {
	const raw = await fs.readFile(packageJsonPath, 'utf8')
	const packageJson = JSON.parse(raw) as PackageJsonShape

	return DEPENDENCY_SECTIONS.flatMap(section => {
		const entries = packageJson[section] ?? {}

		return Object.entries(entries)
			.filter(([name]) => name.startsWith('@format.dev/'))
			.map(([name, version]) => ({ name, section, version }))
	})
}

export interface DependencyMismatch {
	name: string
	section: DependencySection
	actual: string
	expected: string
}

interface CheckAlignmentArgs {
	pinnedVersion: string
	dependencies: FormatDependency[]
}

// Every installed @format.dev/* package must equal the pin exactly. Workspace
// protocol entries are skipped: they only appear during local monorepo dev,
// where versions resolve by link rather than by number.
export function findMismatches(args: CheckAlignmentArgs): DependencyMismatch[] {
	const { pinnedVersion, dependencies } = args

	return dependencies
		.filter(dependency => !dependency.version.startsWith('workspace:'))
		.filter(dependency => dependency.version !== pinnedVersion)
		.map(dependency => ({
			name: dependency.name,
			section: dependency.section,
			actual: dependency.version,
			expected: pinnedVersion
		}))
}

interface RewriteDependenciesArgs {
	packageJsonPath: string
	version: string
}

export interface RewrittenDependency {
	name: string
	from: string
	to: string
}

// Pin every @format.dev/* entry to the exact target version, preserving which
// section each lives in and the file's indentation.
export async function rewriteFormatDependencies(args: RewriteDependenciesArgs): Promise<RewrittenDependency[]> {
	const { packageJsonPath, version } = args

	const raw = await fs.readFile(packageJsonPath, 'utf8')
	const packageJson = JSON.parse(raw) as PackageJsonShape
	const rewritten: RewrittenDependency[] = []

	for (const section of DEPENDENCY_SECTIONS) {
		const entries = packageJson[section]

		if (!entries) {
			continue
		}

		for (const [name, currentVersion] of Object.entries(entries)) {
			const isNotFormatPackage = !name.startsWith('@format.dev/')
			const isWorkspaceLink = currentVersion.startsWith('workspace:')

			if (isNotFormatPackage || isWorkspaceLink || currentVersion === version) {
				continue
			}

			entries[name] = version
			rewritten.push({ name, from: currentVersion, to: version })
		}
	}

	if (rewritten.length > 0) {
		const indent = detectIndent(raw)
		await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, indent)}\n`, 'utf8')
	}

	return rewritten
}
