/**
 * The order packages are approved in, derived from what they declare.
 *
 * A staged package is not installable, so staging needs no order. Approval is
 * where order matters: an approved package is live and installable at once, and
 * a dependent that goes live before its dependency fails to install — the
 * missing dependency answers 404 — until the dependency lands too. Approving a
 * dependency before its dependents removes that window.
 *
 * The order comes out of the manifests, so no operator maintains a list.
 */

import type { PackageManifest } from './surface.ts'

export class OrderError extends Error {}

/**
 * The sections a consumer's install resolves.
 *
 * Development dependencies are absent on purpose: nobody installing a
 * published package resolves them, so a sibling named there constrains
 * nothing about approval. Peers are present because npm installs them
 * automatically, and optional dependencies because a 404 on one still reports
 * an error to whoever installs it.
 */
const RESOLVED_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const

export interface Package {
	name: string
	manifest: PackageManifest
}

/** The scopes the release publishes under, and its unscoped names. */
function releaseNamespace(names: string[]): { scopes: Set<string>; unscoped: Set<string> } {
	const scopes = new Set<string>()
	const unscoped = new Set<string>()

	for (const name of names) {
		if (name.startsWith('@')) scopes.add(name.slice(0, name.indexOf('/')))
		else unscoped.add(name)
	}

	return { scopes, unscoped }
}

/** Every release sibling a package depends on, in the sections an install resolves. */
export function releaseDependencies(pkg: Package, surface: Set<string>): string[] {
	const found = new Set<string>()

	for (const section of RESOLVED_SECTIONS) {
		for (const dependency of Object.keys(pkg.manifest[section] ?? {})) {
			if (surface.has(dependency) && dependency !== pkg.name) found.add(dependency)
		}
	}

	return [...found].sort()
}

/**
 * Dependencies that share the release's namespace but are absent from it.
 *
 * A package under the release's own scope that no release publishes cannot
 * resolve for anyone installing from npm, so the release is incomplete rather
 * than merely unusual.
 */
function unpublishableDependencies(packages: Package[], surface: Set<string>): string[] {
	const { scopes, unscoped } = releaseNamespace([...surface])
	const problems: string[] = []

	for (const pkg of packages) {
		for (const section of RESOLVED_SECTIONS) {
			for (const dependency of Object.keys(pkg.manifest[section] ?? {})) {
				if (surface.has(dependency)) continue

				const scope = dependency.startsWith('@') ? dependency.slice(0, dependency.indexOf('/')) : null
				const internal = scope ? scopes.has(scope) : unscoped.has(dependency)
				if (internal)
					problems.push(`${pkg.name} declares ${section}.${dependency}, which this release does not publish`)
			}
		}
	}

	return problems
}

/** One concrete cycle through the packages that never became ready. */
function describeCycle(stuck: Package[], surface: Set<string>): string {
	const remaining = new Set(stuck.map(pkg => pkg.name))
	const edges = new Map(stuck.map(pkg => [pkg.name, releaseDependencies(pkg, surface).filter(d => remaining.has(d))]))

	const path: string[] = []
	const onPath = new Set<string>()
	let current = stuck[0].name

	while (!onPath.has(current)) {
		onPath.add(current)
		path.push(current)
		current = edges.get(current)![0]
	}

	return [...path.slice(path.indexOf(current)), current].join(' → ')
}

/**
 * The approval order: every package after each release sibling it depends on.
 *
 * Packages that could be approved at the same moment come out sorted by name,
 * so one set of manifests always produces one order and a release manifest can
 * be compared between runs.
 */
export function approvalOrder(packages: Package[]): string[] {
	const surface = new Set(packages.map(pkg => pkg.name))

	const unpublishable = unpublishableDependencies(packages, surface)
	if (unpublishable.length > 0) {
		throw new OrderError(`the release depends on packages it does not publish:\n  ${unpublishable.join('\n  ')}`)
	}

	const waitingOn = new Map(packages.map(pkg => [pkg.name, new Set(releaseDependencies(pkg, surface))]))
	const ordered: string[] = []

	while (ordered.length < packages.length) {
		const ready = [...waitingOn]
			.filter(([, pending]) => pending.size === 0)
			.map(([name]) => name)
			.sort((a, b) => a.localeCompare(b))

		if (ready.length === 0) {
			const stuck = packages.filter(pkg => waitingOn.has(pkg.name))
			throw new OrderError(
				`the release packages depend on each other in a cycle, so no approval order exists: ${describeCycle(stuck, surface)}`
			)
		}

		for (const name of ready) {
			ordered.push(name)
			waitingOn.delete(name)
		}
		for (const pending of waitingOn.values()) {
			for (const name of ready) pending.delete(name)
		}
	}

	return ordered
}
