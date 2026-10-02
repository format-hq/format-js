/**
 * The whole artifact-intrinsic run, in one call: build, pack once, then check
 * the packed bytes.
 *
 * Everything a release can decide from the artifacts alone lives here, so the
 * mirror's own CI and the private smoke hold the packages to one definition of
 * a publishable artifact rather than two that drift. What sits outside is what
 * needs a tree the mirror does not have — installing the tarballs into a
 * consumer, and driving the SDKs, the CLI and the scaffolder against them.
 */

import { approvalOrder } from './order.ts'
import { buildPackages, packPackages, type Tarball } from './artifacts.ts'
import { checkTarballContents, lintTarballs } from './checks.ts'
import { Failures } from './exec.ts'
import { readPublishSurface, type PublishSurface } from './surface.ts'
import type { Run } from './exec.ts'

export interface Reporter {
	/** A stage beginning. */
	step(message: string): void
	/** A line under the current stage. */
	detail(message: string): void
}

export const consoleReporter: Reporter = {
	step: message => console.log(`\n▸ ${message}`),
	detail: message => console.log(`  ${message}`)
}

export const silentReporter: Reporter = { step: () => {}, detail: () => {} }

export interface PackAndCheckOptions {
	/** The tree holding the packages, which is this repository or a generated mirror. */
	repoRoot: string
	/** Where the tarballs land, and where every later stage reads them from. */
	destination: string
	/** The tree whose install holds publint and attw. Defaults to `repoRoot`. */
	toolRoot?: string
	/** Workspace members to keep out of the build, by name; absent ones are ignored. */
	exclude?: string[]
	/** Where the tarball checks report to, so a caller can add its own findings to one list. */
	failures?: Failures
	run?: Run
	reporter?: Reporter
}

export interface PackAndCheckResult {
	surface: PublishSurface
	tarballs: Tarball[]
	/** Every package after each release sibling it depends on. */
	order: string[]
	/** The attw profile each package was held to. */
	profiles: Map<string, string>
	failures: Failures
}

/**
 * Builds, packs and checks the release surface of a tree.
 *
 * Building and packing throw, because a stage that produced no artifact leaves
 * nothing for the later stages to read. The checks over the packed bytes
 * collect instead, so one run reports every tarball's problems rather than the
 * first one's.
 */
export function packAndCheck({
	repoRoot,
	destination,
	toolRoot = repoRoot,
	exclude,
	failures = new Failures(),
	run,
	reporter = consoleReporter
}: PackAndCheckOptions): PackAndCheckResult {
	const surface = readPublishSurface(repoRoot)
	const detail = (message: string) => reporter.detail(message)

	reporter.step('Building')
	buildPackages({ surface, exclude, run, log: detail })

	reporter.step('Packing')
	const tarballs = packPackages({ surface, destination, run, log: detail })

	reporter.step('Checking what the tarballs carry')
	const checkOptions = { tarballs, packages: surface.packages, toolRoot, failures, run, log: detail }
	checkTarballContents(checkOptions)

	reporter.step('Linting the tarballs')
	const profiles = lintTarballs(checkOptions)

	reporter.step('Working out the approval order')
	const order = approvalOrder(surface.packages)
	detail(order.join(' → '))

	return { surface, tarballs, order, profiles, failures }
}
