/**
 * What must hold before a release packs anything.
 *
 * These checks run in a job with no publishing credential, so a release that
 * fails one of them never mints a staging identity at all. Each answers a
 * question about the tag, the tree, or the registry — never about the tarballs,
 * which do not exist yet.
 */

import { execute, type Run } from './exec.ts'
import { parseReleaseTag, PUBLISH_SURFACE_SIZE } from './release-manifest.ts'
import { publishabilityProblems, type PublishSurface } from './surface.ts'
import { NPM_REGISTRY } from './toolchain.ts'

export { PUBLISH_SURFACE_SIZE }

export class PreflightError extends Error {}

function fail(problem: string): never {
	throw new PreflightError(problem)
}

/** The version a release tag names, checked against the contract it must match. */
export function releaseVersionFromTag(tag: string, jsVersion: string): string {
	const version = parseReleaseTag(tag)
	if (version === null) {
		fail(`${tag} is not a release tag — a release tag is "v" and one exact version, like v1.2.3`)
	}
	if (version !== jsVersion) {
		fail(`the tag says ${version} and format-release.json says ${jsVersion}; a release publishes one version`)
	}
	return version
}

export interface GitOptions {
	cwd: string
	run?: Run
	/** The remote holding the branch a release must sit on. */
	remote?: string
	branch?: string
}

/**
 * The commit a tag points at, once that commit is confirmed to be the branch
 * head.
 *
 * Only the sync app writes the mirror's default branch, so a tag on the head of
 * that branch is a commit the private side reviewed and pushed. A tag anywhere
 * else was made some other way, and the release stops.
 */
export function taggedHeadCommit(
	tag: string,
	{ cwd, run = execute, remote = 'origin', branch = 'master' }: GitOptions
): string {
	const tagged = run('git', ['rev-parse', `${tag}^{commit}`], { cwd })
	if (!tagged.ok) fail(`${tag} does not resolve to a commit here:\n${tagged.output}`)

	const fetched = run('git', ['fetch', '--no-tags', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`], {
		cwd
	})
	if (!fetched.ok) fail(`could not fetch ${remote}/${branch} to compare against ${tag}:\n${fetched.output}`)

	const head = run('git', ['rev-parse', `refs/remotes/${remote}/${branch}`], { cwd })
	if (!head.ok) fail(`could not read ${remote}/${branch} after fetching it:\n${head.output}`)

	const taggedCommit = tagged.output.trim()
	const headCommit = head.output.trim()

	if (taggedCommit !== headCommit) {
		fail(
			`${tag} points at ${taggedCommit}, and ${remote}/${branch} is at ${headCommit}\n` +
				`a release publishes the head of ${branch}, which is the only ref the sync writes`
		)
	}

	return taggedCommit
}

/**
 * The contract's shape, and every package's readiness to publish.
 *
 * Both counts are asserted: the contract holds the expected number of names,
 * and the workspace holds no publishable package the contract left out. The
 * second catches a package added without being listed; the first catches a
 * whole tree built from a contract that lost entries.
 */
export function assertPublishSurface(surface: PublishSurface, expectedSize = PUBLISH_SURFACE_SIZE): void {
	const { contract, packages, members } = surface

	if (contract.packages.length !== expectedSize) {
		fail(
			`format-release.json names ${contract.packages.length} packages and this release publishes ` +
				`${expectedSize}\nif the publish surface really changed, change PUBLISH_SURFACE_SIZE with it`
		)
	}

	const listed = new Set(contract.packages.map(name => name))
	const unlisted = members.filter(member => member.manifest.private !== true && !listed.has(member.name))
	if (unlisted.length > 0) {
		fail(
			`the workspace publishes packages the contract does not list: ` +
				`${unlisted.map(member => `${member.name} (${member.path})`).join(', ')}`
		)
	}

	const problems = publishabilityProblems({ ...surface, packages })
	if (problems.length > 0) fail(`the packages are not ready to publish:\n  ${problems.join('\n  ')}`)
}

export interface RegistryOptions {
	names: string[]
	version: string
	cwd: string
	run?: Run
	/** A registry read that hangs is a failure, never an answer. */
	timeoutMs?: number
}

// npm reports a missing package or version with this code. Every other failure
// — a timeout, a DNS error, a rate limit, a 5xx, an auth problem — means the
// registry did not answer, which is not the same as answering "nothing here".
const NOT_FOUND = /\bcode\s+E404\b/

/**
 * Whether every name can still be published at this version.
 *
 * Fail-closed throughout. The base package must already exist, because a
 * release stages versions of packages that npm already knows; a name that
 * answers with the version means someone published it and the release must
 * stop; and only an explicit 404, or an empty answer from a package that does
 * exist, counts as the version being free.
 */
export function assertVersionsAvailable({
	names,
	version,
	cwd,
	run = execute,
	timeoutMs = 60_000
}: RegistryOptions): void {
	const problems: string[] = []

	for (const name of names) {
		const base = run('npm', ['view', name, 'name', '--json', `--registry=${NPM_REGISTRY}`], { cwd, timeoutMs })
		if (!base.ok) {
			problems.push(
				NOT_FOUND.test(base.output)
					? `${name} does not exist on npm — a release stages versions of packages that are already there`
					: `${name}: the registry did not answer, so whether it exists is unknown\n${base.output.trim()}`
			)
			continue
		}

		// A command that exited zero is not an answer. The registry has to have
		// named the package back, or something else answered — a proxy, a cached
		// error page, a redirect — and taking that as proof the name exists would
		// carry the release forward on nothing.
		const named = (() => {
			try {
				return JSON.parse(base.output.trim()) as unknown
			} catch {
				return null
			}
		})()
		if (named !== name) {
			problems.push(
				`${name}: the registry answered with ${JSON.stringify(base.output.trim()).slice(0, 120)} rather than the ` +
					'package name, so whether it exists is unknown'
			)
			continue
		}

		const taken = run('npm', ['view', `${name}@${version}`, 'version', '--json', `--registry=${NPM_REGISTRY}`], {
			cwd,
			timeoutMs
		})

		if (taken.ok) {
			const answer = taken.output.trim()
			// An existing package with no such version answers with nothing at all.
			if (answer === '') continue

			let parsed: unknown
			try {
				parsed = JSON.parse(answer)
			} catch {
				problems.push(`${name}@${version}: the registry answered with something this cannot read\n${answer}`)
				continue
			}
			problems.push(`${name}@${version} is already published as ${JSON.stringify(parsed)}`)
			continue
		}

		if (!NOT_FOUND.test(taken.output)) {
			problems.push(
				`${name}@${version}: the registry did not answer, so it is not known to be free\n${taken.output.trim()}`
			)
		}
	}

	if (problems.length > 0) fail(`the registry does not allow this release:\n  ${problems.join('\n  ')}`)
}
