/**
 * The publish surface: which packages a release covers, and where they sit.
 *
 * Names come from the release contract, `format-release.json`. Locations come
 * from expanding `pnpm-workspace.yaml`'s globs here, in plain Node, so this
 * runs in a tree that has not been installed and in one that has no pnpm on
 * the path.
 */

import { globSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

import { readReleaseManifest, type ReleaseManifest } from '../release/manifest.ts'

/**
 * The release contract — `format-release.json`, parsed and validated.
 *
 * Aliased once, here, and imported from this module everywhere else in the
 * folder. Two different documents govern a release: this one says what the
 * release contains, and the release manifest written during a release records
 * what was actually built. Naming them apart keeps every later reference
 * unambiguous.
 */
export type ReleaseContract = ReleaseManifest
export const readReleaseContract = readReleaseManifest

export interface PackageManifest {
	name?: string
	version?: string
	private?: boolean
	/** The SPDX expression the package publishes under. */
	license?: string
	exports?: unknown
	/** A path, which npm names after the package, or a name-to-path map. */
	bin?: string | Record<string, string>
	engines?: Record<string, string>
	scripts?: Record<string, string>
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
	publishConfig?: { access?: string; tag?: string }
	repository?: { type?: string; url?: string; directory?: string }
}

export interface WorkspaceMember {
	name: string
	/** Absolute. */
	dir: string
	/** Relative to the repository root, with forward slashes. */
	path: string
	manifest: PackageManifest
}

export class SurfaceError extends Error {}

/**
 * The `packages:` globs from `pnpm-workspace.yaml`.
 *
 * The block runs until the next top-level key. Each entry is a glob, and may
 * be quoted, negated, or followed by a comment.
 */
function readWorkspaceGlobs(repoRoot: string): string[] {
	const yaml = readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')

	const block = yaml.match(/^packages:\n((?:[ \t]+-.*\n|[ \t]*\n)*)/m)?.[1]
	if (!block) throw new SurfaceError(`${repoRoot}/pnpm-workspace.yaml declares no packages globs`)

	const globs: string[] = []
	for (const line of block.split('\n')) {
		const entry = line.match(/^\s+-\s*(.+?)\s*$/)?.[1]
		if (!entry) continue
		globs.push(entry.replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, ''))
	}
	if (globs.length === 0) throw new SurfaceError(`${repoRoot}/pnpm-workspace.yaml declares no packages globs`)

	return globs
}

/**
 * Every workspace member, resolved from the globs rather than asked of pnpm.
 *
 * Installed dependencies and build output are skipped: a `**` glob that walks
 * `node_modules` takes minutes, and a `dist` directory can hold a copied
 * manifest that is not a member of anything.
 */
export function readWorkspaceMembers(repoRoot: string): WorkspaceMember[] {
	const skip = (path: string) => path.includes('node_modules') || path.includes('/dist/')
	const manifestsFor = (glob: string) => globSync(`${glob}/package.json`, { cwd: repoRoot, exclude: skip })

	const globs = readWorkspaceGlobs(repoRoot)

	const included = new Set<string>()
	for (const glob of globs.filter(glob => !glob.startsWith('!'))) {
		for (const match of manifestsFor(glob)) included.add(match)
	}

	const excluded = new Set<string>()
	for (const glob of globs.filter(glob => glob.startsWith('!'))) {
		for (const match of manifestsFor(glob.slice(1))) excluded.add(match)
	}

	const members: WorkspaceMember[] = []
	const seen = new Map<string, string>()

	for (const manifestPath of [...included].sort()) {
		if (excluded.has(manifestPath)) continue

		const manifest = JSON.parse(readFileSync(join(repoRoot, manifestPath), 'utf8')) as PackageManifest
		if (typeof manifest.name !== 'string') continue

		const path = dirname(manifestPath).split('\\').join('/')

		const first = seen.get(manifest.name)
		if (first) {
			throw new SurfaceError(
				`${manifest.name} is declared at both ${first} and ${path} — one name cannot resolve to two packages`
			)
		}
		seen.set(manifest.name, path)

		members.push({ name: manifest.name, dir: join(repoRoot, path), path, manifest })
	}

	return members
}

export interface PublishSurface {
	repoRoot: string
	contract: ReleaseContract
	/** In the contract's order, which is the order a reader of that file expects. */
	packages: WorkspaceMember[]
	/** Every member, including the ones a release does not publish. */
	members: WorkspaceMember[]
}

/** The contract's names, resolved against the tree they are meant to describe. */
export function readPublishSurface(repoRoot: string): PublishSurface {
	const contract = readReleaseContract(join(repoRoot, 'format-release.json'))
	const members = readWorkspaceMembers(repoRoot)
	const byName = new Map(members.map(member => [member.name, member]))

	const missing = contract.packages.filter(name => !byName.has(name))
	if (missing.length > 0) {
		throw new SurfaceError(
			`format-release.json names ${missing.join(', ')}, which the workspace at ${repoRoot} does not contain`
		)
	}

	return { repoRoot, contract, packages: contract.packages.map(name => byName.get(name)!), members }
}

/**
 * What every package in the surface must declare before a release packs it.
 *
 * Returns the problems rather than throwing on the first, so one run reports
 * the whole set. A manifest off the contract's version is the sync or the
 * stamper having gone wrong, and a `private` flag on a listed package would
 * make npm reject the publish after eleven siblings were already staged.
 */
export function publishabilityProblems({ contract, packages }: PublishSurface): string[] {
	const problems: string[] = []

	for (const { name, path, manifest } of packages) {
		if (manifest.version !== contract.jsVersion) {
			problems.push(
				`${name} (${path}) is version ${String(manifest.version)}, and the contract says ${contract.jsVersion}`
			)
		}
		if (manifest.private === true) {
			problems.push(`${name} (${path}) is marked private, so npm would refuse to publish it`)
		}
	}

	return problems
}

/** A package's path inside the repository, for `repository.directory` and messages. */
export const relativePath = (repoRoot: string, dir: string) => relative(repoRoot, dir).split('\\').join('/')
