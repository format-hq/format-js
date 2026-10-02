/**
 * Staging the tarballs a release already built.
 *
 *   node build/publish/stage.ts --artifacts <dir> --tag v1.2.3 --commit <sha> --dist-tag beta
 *
 * This is the one part of a release that runs while a publishing credential
 * exists, so it does the least it can. It installs nothing, builds nothing,
 * packs nothing and runs no package script. What it reads is a directory of
 * tarballs and the release manifest written beside them, in a job that had no
 * credential; what it does is hand those exact files to npm.
 *
 * That earlier job ran an install and a build, so its record is a claim rather
 * than an authority, and three checks here treat it as one. Every digest is
 * recomputed, so bytes that changed between the jobs stop the release. The
 * package set is compared against `format-release.json` at the tagged commit,
 * which is reviewed content. And each tarball is opened to read the
 * `package.json` npm itself would publish it under, so a file that would go
 * live as something else stops the release even with a matching digest.
 *
 * The dist-tag and the registry are passed on every command, so nothing goes
 * live under npm's default `latest`, and nothing is staged to whichever
 * registry the runner's configuration happened to name.
 *
 * Staging makes nothing installable. A maintainer approves each staged package
 * afterwards, with a second factor, in the order this prints.
 */

import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { execute, type Run } from './exec.ts'
import {
	contractProblems,
	parseReleaseRecord,
	RELEASE_MANIFEST_FILE,
	verifyPackedIdentities,
	verifyTarballDirectory,
	type ReleaseRecord
} from './release-manifest.ts'
import { NPM_REGISTRY } from './toolchain.ts'
import { readReleaseManifest, REPO_ROOT } from '../release/manifest.ts'

const FLAGS = ['--artifacts', '--tag', '--commit', '--dist-tag'] as const

export class StageError extends Error {}

export interface StageOptions {
	artifacts: string
	tag: string
	commit: string
	distTag: string
}

/**
 * Reads the arguments, rejecting anything ambiguous.
 *
 * Nothing defaults. Every value here names part of what goes to npm, and a
 * missing one must stop the job rather than resolve to whatever the tree
 * happens to say.
 */
export function parseArguments(argv: string[]): StageOptions {
	const values = new Map<string, string>()

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (!FLAGS.includes(arg as (typeof FLAGS)[number])) throw new StageError(`unknown argument: ${arg}`)
		if (values.has(arg)) throw new StageError(`${arg} was given twice`)

		const value = argv[++i]
		if (value === undefined || value.startsWith('--')) throw new StageError(`${arg} needs a value`)
		values.set(arg, value)
	}

	for (const flag of FLAGS) {
		if (!values.get(flag)) throw new StageError(`staging needs ${flag}`)
	}

	return {
		artifacts: resolve(values.get('--artifacts')!),
		tag: values.get('--tag')!,
		commit: values.get('--commit')!,
		distTag: values.get('--dist-tag')!
	}
}

/**
 * The release manifest, checked against the release this job was told it is
 * staging, the contract at the tagged commit, and the tarballs themselves.
 *
 * The tag and commit arrive from the workflow's own context, so agreement
 * between them and the manifest means the artifact came from the run this job
 * belongs to. `repoRoot` is the checkout of that same tagged commit, which is
 * where the reviewed release contract lives.
 */
export function readVerifiedRecord(
	{ artifacts, tag, commit, distTag }: StageOptions,
	repoRoot: string = REPO_ROOT
): ReleaseRecord {
	const manifestPath = join(artifacts, RELEASE_MANIFEST_FILE)
	if (!existsSync(manifestPath)) {
		throw new StageError(`${artifacts} holds no ${RELEASE_MANIFEST_FILE}, so there is nothing describing what to stage`)
	}
	if (!statSync(artifacts).isDirectory()) throw new StageError(`${artifacts} is not a directory`)

	const record = parseReleaseRecord(readFileSync(manifestPath, 'utf8'))

	if (record.tag !== tag) {
		throw new StageError(`the release manifest is for ${record.tag} and this run is ${tag}`)
	}
	if (record.sourceCommit !== commit) {
		throw new StageError(`the release manifest was built at ${record.sourceCommit} and this run is at ${commit}`)
	}

	const wrongTag = record.packages.filter(entry => entry.distTag !== distTag)
	if (wrongTag.length > 0) {
		throw new StageError(
			`this run stages under ${distTag}, and the release manifest says ` +
				`${[...new Set(wrongTag.map(entry => entry.distTag))].join(', ')} for ` +
				`${wrongTag.map(entry => entry.name).join(', ')}`
		)
	}

	const contract = readReleaseManifest(join(repoRoot, 'format-release.json'))
	const againstContract = contractProblems(record, contract)
	if (againstContract.length > 0) {
		throw new StageError(
			`the release manifest does not describe the release this commit publishes:\n  ${againstContract.join('\n  ')}`
		)
	}

	const problems = verifyTarballDirectory(artifacts, record)
	if (problems.length > 0) {
		throw new StageError(`the tarballs do not match the release manifest:\n  ${problems.join('\n  ')}`)
	}

	const identities = verifyPackedIdentities(artifacts, record)
	if (identities.length > 0) {
		throw new StageError(`the tarballs would publish as something else:\n  ${identities.join('\n  ')}`)
	}

	return record
}

export interface StageRunOptions {
	record: ReleaseRecord
	artifacts: string
	distTag: string
	run?: Run
	log?: (message: string) => void
}

/**
 * Hands each tarball to npm, in approval order, under the stated dist-tag.
 *
 * Staging order does not matter — a staged package is not installable — but
 * staging in approval order means the printed list is the order a maintainer
 * then approves in, with no second ordering to consult.
 *
 * A failure stops the run. Recovery is rejecting the stages that did land and
 * running the release again from the same tag, and that is easier to reason
 * about than a partial set staged around a package that failed.
 */
export function stagePackages({ record, artifacts, distTag, run = execute, log = () => {} }: StageRunOptions): void {
	for (const entry of record.packages) {
		const tarball = join(artifacts, entry.tarball)
		const staged = run('npm', ['stage', 'publish', tarball, '--tag', distTag, `--registry=${NPM_REGISTRY}`], {
			cwd: artifacts
		})

		if (!staged.ok) {
			throw new StageError(
				`staging ${entry.name}@${entry.version} failed after ${entry.position} package(s) staged:\n${staged.output}\n\n` +
					'the staged packages are not installable. Reject them, then run the release again from this tag.'
			)
		}

		log(`staged ${entry.name}@${entry.version} under ${distTag}`)
	}
}

/** The table a maintainer approves from: what was staged, in what order, and its digest. */
export function summarise(record: ReleaseRecord): string {
	const rows = record.packages.map(
		entry =>
			`| ${entry.position + 1} | \`${entry.name}\` | ${entry.version} | \`${entry.distTag}\` | \`${entry.sha512}\` |`
	)

	return [
		`## Staged ${record.tag}`,
		'',
		`Built from \`${record.sourceCommit}\`. Nothing is installable until each package is approved, in this order.`,
		'',
		'| # | package | version | dist-tag | sha-512 |',
		'| --- | --- | --- | --- | --- |',
		...rows,
		''
	].join('\n')
}

function main(argv: string[]): void {
	const options = parseArguments(argv)
	const record = readVerifiedRecord(options)

	console.log(`Staging ${record.tag} from ${record.sourceCommit.slice(0, 12)} under ${options.distTag}`)
	console.log(`${record.packages.length} tarballs, verified against the release manifest`)

	stagePackages({
		record,
		artifacts: options.artifacts,
		distTag: options.distTag,
		log: message => console.log(`  ${message}`)
	})

	const summary = summarise(record)
	if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
	console.log(`\n${record.packages.length} packages staged. Approve them in the order above.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main(process.argv.slice(2))
	} catch (error) {
		console.error(`\n${error instanceof Error ? error.message : String(error)}`)
		process.exitCode = 1
	}
}
