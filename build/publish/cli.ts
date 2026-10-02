/**
 * The public entry point for checking and for preparing a release.
 *
 *   node build/publish/cli.ts check
 *   node build/publish/cli.ts release --output <dir> --tag v1.2.3 --dist-tag beta
 *
 * `check` builds the packages, packs them once, and holds the tarballs to the
 * content rules, publint and attw. It touches no network beyond the install
 * that preceded it, and it is what a pull request against the public mirror
 * runs.
 *
 * `release` runs the same checks after the tag, the tree and the registry have
 * been agreed, and writes the tarballs and a release manifest into a directory.
 * It holds no publishing credential: staging reads what this produced, in a
 * separate job.
 *
 *   --repo-root <dir>   the tree holding the packages (default: this one)
 *   --tool-root <dir>   the tree whose install holds publint and attw
 *   --output <dir>      where the tarballs and release manifest land
 *   --tag <vJ>          the release tag, which must match the release contract
 *   --dist-tag <tag>    the npm tag the packages go live under
 *   --keep              leave `check`'s temporary tarballs on disk
 */

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { REPO_ROOT } from '../release/manifest.ts'
import { assertPublishSurface, assertVersionsAvailable, releaseVersionFromTag, taggedHeadCommit } from './preflight.ts'
import {
	buildReleaseRecord,
	formatReleaseRecord,
	RELEASE_MANIFEST_FILE,
	verifyPackedIdentities,
	type ReleaseRecord
} from './release-manifest.ts'
import { consoleReporter, packAndCheck } from './run.ts'
import { readPublishSurface } from './surface.ts'

const COMMANDS = ['check', 'release'] as const
type Command = (typeof COMMANDS)[number]

const FLAGS = ['--repo-root', '--tool-root', '--output', '--tag', '--dist-tag'] as const
const SWITCHES = ['--keep'] as const

export class UsageError extends Error {}

interface Options {
	command: Command
	repoRoot: string
	toolRoot: string
	output: string
	tag: string
	distTag: string
	keep: boolean
}

/**
 * Reads the arguments, rejecting anything ambiguous.
 *
 * A repeated flag, an unknown flag and a missing value all stop the run: this
 * decides what a release publishes, so a mistyped argument must not fall
 * through to a default.
 */
export function parseArguments(argv: string[]): Options {
	const [command, ...rest] = argv
	if (!command) throw new UsageError(`name a command: ${COMMANDS.join(', ')}`)
	if (!COMMANDS.includes(command as Command)) throw new UsageError(`unknown command: ${command}`)

	const values = new Map<string, string>()
	let keep = false

	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i]

		if (SWITCHES.includes(arg as (typeof SWITCHES)[number])) {
			if (keep) throw new UsageError(`${arg} was given twice`)
			keep = true
			continue
		}

		if (!FLAGS.includes(arg as (typeof FLAGS)[number])) throw new UsageError(`unknown argument: ${arg}`)
		if (values.has(arg)) throw new UsageError(`${arg} was given twice`)

		const value = rest[++i]
		if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`)
		values.set(arg, value)
	}

	const repoRoot = resolve(values.get('--repo-root') ?? REPO_ROOT)
	const options: Options = {
		command: command as Command,
		repoRoot,
		toolRoot: resolve(values.get('--tool-root') ?? repoRoot),
		output: values.get('--output') ? resolve(values.get('--output')!) : '',
		tag: values.get('--tag') ?? '',
		distTag: values.get('--dist-tag') ?? '',
		keep
	}

	if (options.command === 'release') {
		for (const [flag, value] of [
			['--output', options.output],
			['--tag', options.tag],
			['--dist-tag', options.distTag]
		]) {
			if (!value) throw new UsageError(`release needs ${flag}`)
		}
	} else {
		for (const flag of ['--output', '--tag', '--dist-tag'] as const) {
			if (values.has(flag)) throw new UsageError(`${flag} belongs to release, not check`)
		}
	}

	return options
}

function check(options: Options): number {
	const destination = mkdtempSync(join(tmpdir(), 'format-pack-'))

	try {
		const { surface, tarballs, failures } = packAndCheck({
			repoRoot: options.repoRoot,
			toolRoot: options.toolRoot,
			destination
		})

		if (failures.any) {
			console.error(`\n${failures.all.length} failure(s):\n\n${failures.format()}\n`)
			return 1
		}

		console.log(
			`\nAll ${tarballs.length} packages build, pack and lint clean at ${surface.contract.jsVersion}.` +
				'\nInstalling them into a consumer and running them is the private smoke, which the release gates on.'
		)
		return 0
	} finally {
		if (options.keep) console.log(`\nkept: ${destination}`)
		else rmSync(destination, { recursive: true, force: true })
	}
}

function release(options: Options): number {
	const surface = readPublishSurface(options.repoRoot)
	const { jsVersion } = surface.contract

	const reporter = consoleReporter

	reporter.step('Checking the tag, the tree and the registry')
	assertPublishSurface(surface)
	const version = releaseVersionFromTag(options.tag, jsVersion)
	const sourceCommit = taggedHeadCommit(options.tag, { cwd: options.repoRoot })
	reporter.detail(`${options.tag} is ${sourceCommit.slice(0, 12)}, the head of the branch the sync writes`)

	assertVersionsAvailable({ names: surface.contract.packages, version, cwd: options.repoRoot })
	reporter.detail(`every name exists on npm and none is published at ${version}`)

	mkdirSync(options.output, { recursive: true })
	if (readdirSync(options.output).length > 0) {
		throw new UsageError(`${options.output} is not empty — a release writes its artifacts into a clean directory`)
	}

	const { tarballs, order, failures } = packAndCheck({
		repoRoot: options.repoRoot,
		toolRoot: options.toolRoot,
		destination: options.output,
		reporter
	})

	if (failures.any) {
		console.error(`\n${failures.all.length} failure(s):\n\n${failures.format()}\n`)
		return 1
	}

	reporter.step('Writing the release manifest')
	const record = buildReleaseRecord({
		sourceCommit,
		tag: options.tag,
		jsVersion: version,
		distTag: options.distTag,
		order,
		tarballs
	})
	// Read back out of the tarballs, so what the manifest claims about each
	// package is what the packed bytes say about themselves. The staging job
	// repeats this; a mismatch is worth finding in the job that can still fix it.
	const identities = verifyPackedIdentities(options.output, record)
	if (identities.length > 0) {
		console.error(`\nthe tarballs would publish as something else:\n  ${identities.join('\n  ')}\n`)
		return 1
	}

	writeFileSync(join(options.output, RELEASE_MANIFEST_FILE), formatReleaseRecord(record))
	printRecord(record)

	console.log(`\n${record.packages.length} tarballs and a release manifest in ${options.output}`)
	console.log('Nothing has been staged or published — that happens in the job that holds the credential.')
	return 0
}

function printRecord(record: ReleaseRecord): void {
	for (const entry of record.packages) {
		console.log(`  ${String(entry.position).padStart(2)}  ${entry.name}@${entry.version}  ${entry.sha512}`)
	}
}

const main = (): number => {
	const options = parseArguments(process.argv.slice(2))
	return options.command === 'check' ? check(options) : release(options)
}

// Guarded so a test can import the argument grammar without running a build.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		process.exitCode = main()
	} catch (error) {
		console.error(`\n${error instanceof Error ? error.message : String(error)}`)
		process.exitCode = error instanceof UsageError ? 2 : 1
	}
}
