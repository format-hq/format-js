import type { MissingConfig, MissingDependency, PrerequisiteReport, StylingMethod } from '../types.ts'

import fs from 'node:fs/promises'
import { join } from 'node:path'

interface ProjectPackageJson {
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

export async function readProjectDependencies(projectRoot: string): Promise<Set<string>> {
	try {
		const raw = await fs.readFile(join(projectRoot, 'package.json'), 'utf8')
		const pkg = JSON.parse(raw) as ProjectPackageJson

		return new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])
	} catch {
		// No readable package.json — treat every dependency as missing so the
		// report still tells the user what to install.
		return new Set()
	}
}

interface BuildReportArgs {
	method: StylingMethod
	missingDependencies: MissingDependency[]
	missingConfig: MissingConfig[]
}

export function buildReport(args: BuildReportArgs): PrerequisiteReport {
	const { method, missingDependencies, missingConfig } = args

	const steps: string[] = []

	if (missingDependencies.length > 0) {
		const names = missingDependencies.map(dependency => dependency.name).join(' ')
		const flag = missingDependencies.every(dependency => dependency.dev) ? '-D ' : ''
		steps.push(`Install the required package: \`pnpm add ${flag}${names}\``)
	}

	for (const config of missingConfig) {
		steps.push(config.description)
	}

	const satisfied = missingDependencies.length === 0 && missingConfig.length === 0

	return { method, satisfied, missingDependencies, missingConfig, steps }
}

export function satisfied(method: StylingMethod): PrerequisiteReport {
	return buildReport({ method, missingDependencies: [], missingConfig: [] })
}

interface RequireDependencyArgs {
	method: StylingMethod
	dependency: string
	installed: Set<string>
	missingConfig?: MissingConfig[]
}

// The common shape for methods whose only prerequisite is a single npm package
// that Studio's dev server already has a Vite plugin for.
export function requireDependency(args: RequireDependencyArgs): PrerequisiteReport {
	const { method, dependency, installed, missingConfig = [] } = args

	const missingDependencies: MissingDependency[] = installed.has(dependency) ? [] : [{ name: dependency, dev: true }]

	return buildReport({ method, missingDependencies, missingConfig })
}
