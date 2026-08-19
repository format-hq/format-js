import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const req = createRequire(import.meta.url)

export function basePackageName(id: string) {
	// Convert subpaths (e.g. `react-dom/client`) into package names (`react-dom`).
	// Preserve scoped packages (e.g. `@scope/name/subpath` -> `@scope/name`).
	if (id.startsWith('@')) {
		const parts = id.split('/')
		return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : id
	}
	return id.split('/')[0] ?? id
}

const pkgJsonPathCache = new Map<string, string | null>()
function resolvePackageJsonPath(pkg: string): string | null {
	const name = basePackageName(pkg)
	const cached = pkgJsonPathCache.get(name)
	if (cached !== undefined) return cached

	try {
		const p = req.resolve(`${name}/package.json`)
		pkgJsonPathCache.set(name, p)
		return p
	} catch {
		// Some packages restrict `package.json` in `exports`.
		// Fall back to locating package.json from the resolved entry file.
		try {
			const entry = req.resolve(name)
			let dir = dirname(entry)
			for (let i = 0; i < 10; i++) {
				const candidate = join(dir, 'package.json')
				try {
					JSON.parse(readFileSync(candidate, 'utf8'))
					pkgJsonPathCache.set(name, candidate)
					return candidate
				} catch {
					// keep walking
				}
				dir = dirname(dir)
			}
		} catch {
			// ignore
		}
		pkgJsonPathCache.set(name, null)
		return null
	}
}

const directDepsCache = new Map<string, string[]>()
function getDirectDeps(pkg: string): string[] {
	const name = basePackageName(pkg)
	const cached = directDepsCache.get(name)
	if (cached) return cached

	const pkgJsonPath = resolvePackageJsonPath(name)
	if (!pkgJsonPath) {
		directDepsCache.set(name, [])
		return []
	}

	try {
		const json = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
			dependencies?: Record<string, string>
			optionalDependencies?: Record<string, string>
		}
		const deps = [...Object.keys(json.dependencies ?? {}), ...Object.keys(json.optionalDependencies ?? {})].map(
			basePackageName
		)
		directDepsCache.set(name, deps)
		return deps
	} catch {
		directDepsCache.set(name, [])
		return []
	}
}

type ExpandDependencyClosureInput = {
	seedPackages: string[]
	excludedPackages?: string[]
}

export function expandTransitiveDependencyClosure(input: ExpandDependencyClosureInput): string[] {
	const { seedPackages, excludedPackages = [] } = input
	const excluded = new Set(excludedPackages.map(basePackageName))
	const out = new Set<string>()
	const queue = seedPackages.map(basePackageName)

	// Vite's `ssr.noExternal` is not recursive for package dependency graphs.
	// We expand the full transitive closure so nested sanitizer deps are also bundled.
	while (queue.length) {
		const next = queue.pop()
		if (!next) continue

		const name = basePackageName(next)
		if (out.has(name)) continue
		out.add(name)

		if (excluded.has(name)) continue

		for (const dep of getDirectDeps(name)) {
			if (!out.has(dep) && !excluded.has(dep)) {
				queue.push(dep)
			}
		}
	}

	return [...out]
}
