/**
 * The release manifest: the record of what one release built.
 *
 * A release packs its tarballs in a job that holds no publishing credential,
 * writes this file beside them, and hands both to the job that stages. That
 * job rebuilds nothing and trusts nothing it was told — it recomputes every
 * digest and compares it against this record, so bytes altered between the two
 * jobs stop the release rather than reaching npm.
 *
 * Distinct from the release *contract*, `format-release.json`, which says what
 * a release will contain before anything is built.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { digestFile } from './digest.ts'
import { readPackedManifest } from './tarball.ts'
import { parseVersion } from '../release/version.ts'

/**
 * How many packages a release covers.
 *
 * Kept as its own number rather than counted from a tree. The mirror's
 * workspace is generated from the release contract, so it agrees with the
 * contract whatever the contract says, and a sync that dropped a package would
 * produce a smaller workspace and a smaller contract that still matched each
 * other. Changing the publish surface is a reviewed change to this line too.
 */
export const PUBLISH_SURFACE_SIZE = 12

/**
 * The schema this module writes and the only one it reads.
 *
 * A staging job that meets a manifest it does not recognise refuses it, rather
 * than reading the fields it happens to understand and staging on a partial
 * picture.
 */
export const RELEASE_MANIFEST_SCHEMA = 'format-release-manifest/1'

/** The file name a release writes beside its tarballs. */
export const RELEASE_MANIFEST_FILE = 'release-manifest.json'

export interface ReleaseEntry {
	name: string
	version: string
	/** The dist-tag the package goes live under, always stated, never defaulted. */
	distTag: string
	/** The tarball's file name, which is also its name on disk. */
	tarball: string
	/** npm's integrity form, `sha512-<base64>`. */
	sha512: string
	/** Where this package sits in the approval order, counting from zero. */
	position: number
}

export interface ReleaseRecord {
	schema: string
	/** The commit the mirror published from, in full. */
	sourceCommit: string
	/** The release tag, `v` followed by the version. */
	tag: string
	/** The version every package in the release carries. */
	jsVersion: string
	packages: ReleaseEntry[]
}

export class ReleaseRecordError extends Error {}

const RECORD_FIELDS = ['schema', 'sourceCommit', 'tag', 'jsVersion', 'packages'] as const
const ENTRY_FIELDS = ['name', 'version', 'distTag', 'tarball', 'sha512', 'position'] as const

const COMMIT = /^[0-9a-f]{40}$/
const DIGEST = /^sha512-[A-Za-z0-9+/]+={0,2}$/
// npm rejects a dist-tag that parses as a version, so a tag starting with a
// letter cannot collide with one.
const DIST_TAG = /^[a-z][a-z0-9-]*$/

/**
 * The name npm gives a package's tarball: the scope's `@` dropped, its slash
 * turned into a dash, then the version.
 *
 * Computed rather than read from what a pack command printed, so a rename
 * between packing and staging is a mismatch to report rather than a path to
 * follow.
 */
export function tarballName(name: string, version: string): string {
	return `${name.replace(/^@/, '').split('/').join('-')}-${version}.tgz`
}

/**
 * The version inside a release tag, or null if the tag is not one.
 *
 * Deliberately narrower than semver: a release is one exact number, and a tag
 * like `v1.0` or `v1.0.0-beta.1` names something this pipeline cannot publish.
 */
export function parseReleaseTag(tag: string): string | null {
	if (!tag.startsWith('v')) return null
	const version = tag.slice(1)
	return parseVersion(version) === null ? null : version
}

export interface RecordInput {
	sourceCommit: string
	tag: string
	jsVersion: string
	distTag: string
	/** In approval order: every package after each release sibling it depends on. */
	order: string[]
	tarballs: { name: string; version: string; file: string; sha512: string }[]
}

/** Assembles a record from one run's tarballs and its approval order. */
export function buildReleaseRecord({
	sourceCommit,
	tag,
	jsVersion,
	distTag,
	order,
	tarballs
}: RecordInput): ReleaseRecord {
	const byName = new Map(tarballs.map(tarball => [tarball.name, tarball]))

	const packages = order.map((name, position) => {
		const tarball = byName.get(name)
		if (!tarball) throw new ReleaseRecordError(`the approval order names ${name}, which this run did not pack`)

		return {
			name,
			version: tarball.version,
			distTag,
			tarball: tarball.file,
			sha512: tarball.sha512,
			position
		}
	})

	const unordered = tarballs.filter(tarball => !order.includes(tarball.name))
	if (unordered.length > 0) {
		throw new ReleaseRecordError(
			`this run packed ${unordered.map(t => t.name).join(', ')}, which the approval order omits`
		)
	}

	const record = { schema: RELEASE_MANIFEST_SCHEMA, sourceCommit, tag, jsVersion, packages }
	// Round-tripped through the validator so a manifest is never written in a
	// shape the staging job would then refuse.
	return parseReleaseRecord(JSON.stringify(record))
}

export function formatReleaseRecord(record: ReleaseRecord): string {
	return `${JSON.stringify(record, null, '\t')}\n`
}

function fail(problem: string): never {
	throw new ReleaseRecordError(`the release manifest is invalid: ${problem}`)
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== 'string' || value === '')
		fail(`${field} must be a non-empty string, got ${JSON.stringify(value)}`)
	return value
}

/**
 * Parses a release manifest, rejecting anything a staging job would have to
 * guess about.
 *
 * Unknown fields are refused rather than ignored: a manifest written by newer
 * tooling may mean something this reader would get wrong, and a release is not
 * the place to find out.
 */
export function parseReleaseRecord(text: string): ReleaseRecord {
	let raw: unknown
	try {
		raw = JSON.parse(text)
	} catch (error) {
		fail(`not valid JSON (${error instanceof Error ? error.message : String(error)})`)
	}

	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) fail('the top level must be an object')
	const record = raw as Record<string, unknown>

	const unknown = Object.keys(record).filter(key => !RECORD_FIELDS.includes(key as (typeof RECORD_FIELDS)[number]))
	if (unknown.length > 0) fail(`unknown field(s): ${unknown.join(', ')}. Allowed: ${RECORD_FIELDS.join(', ')}`)

	const schema = requireString(record.schema, 'schema')
	if (schema !== RELEASE_MANIFEST_SCHEMA) {
		fail(`schema is ${JSON.stringify(schema)}, and this tooling reads ${RELEASE_MANIFEST_SCHEMA} alone`)
	}

	const sourceCommit = requireString(record.sourceCommit, 'sourceCommit')
	if (!COMMIT.test(sourceCommit)) fail(`sourceCommit must be a full 40-character commit, got ${sourceCommit}`)

	const jsVersion = requireString(record.jsVersion, 'jsVersion')
	if (parseVersion(jsVersion) === null) fail(`jsVersion must be an exact version like "0.1.0", got ${jsVersion}`)

	const tag = requireString(record.tag, 'tag')
	if (tag !== `v${jsVersion}`) fail(`tag is ${tag}, and jsVersion ${jsVersion} makes the release tag v${jsVersion}`)

	if (!Array.isArray(record.packages) || record.packages.length === 0) {
		fail('packages must be a non-empty array')
	}

	const packages = record.packages.map((entry, index) => parseEntry(entry, index, jsVersion))

	const names = packages.map(entry => entry.name)
	const duplicated = names.filter((name, index) => names.indexOf(name) !== index)
	if (duplicated.length > 0) fail(`packages lists ${[...new Set(duplicated)].join(', ')} more than once`)

	return { schema, sourceCommit, tag, jsVersion, packages }
}

function parseEntry(raw: unknown, index: number, jsVersion: string): ReleaseEntry {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) fail(`packages[${index}] must be an object`)
	const entry = raw as Record<string, unknown>

	const unknown = Object.keys(entry).filter(key => !ENTRY_FIELDS.includes(key as (typeof ENTRY_FIELDS)[number]))
	if (unknown.length > 0) fail(`packages[${index}] has unknown field(s): ${unknown.join(', ')}`)

	const name = requireString(entry.name, `packages[${index}].name`)
	const version = requireString(entry.version, `packages[${index}].version`)
	if (version !== jsVersion) fail(`${name} is version ${version}, and the release is ${jsVersion}`)

	const distTag = requireString(entry.distTag, `packages[${index}].distTag`)
	if (!DIST_TAG.test(distTag)) fail(`${name} has dist-tag ${JSON.stringify(distTag)}, which npm would not accept`)

	const tarball = requireString(entry.tarball, `packages[${index}].tarball`)
	const expected = tarballName(name, version)
	if (tarball !== expected) fail(`${name} names tarball ${tarball}, and npm packs it as ${expected}`)

	const sha512 = requireString(entry.sha512, `packages[${index}].sha512`)
	if (!DIGEST.test(sha512)) fail(`${name} has digest ${sha512}, which is not npm's sha512-<base64> form`)

	if (entry.position !== index) {
		fail(`${name} is at index ${index} with position ${JSON.stringify(entry.position)}; the two must agree`)
	}

	return { name, version, distTag, tarball, sha512, position: index }
}

/**
 * Compares a directory of tarballs against a record, byte for byte.
 *
 * Every member of the directory is accounted for, not only the ones ending in
 * `.tgz`: a release hands npm a directory someone else's job filled, and a file
 * nobody expected sitting in it is a reason to stop rather than something to
 * filter out.
 *
 * Returns every problem it found, because a release is easier to diagnose from
 * the whole picture than from whichever file happened to be read first.
 */
export function verifyTarballDirectory(directory: string, record: ReleaseRecord): string[] {
	const problems: string[] = []
	const expected = new Map(record.packages.map(entry => [entry.tarball, entry]))

	const present = readdirSync(directory)

	for (const file of present) {
		if (file !== RELEASE_MANIFEST_FILE && !expected.has(file)) {
			problems.push(`${file} is in the directory and not in the release manifest`)
		}
	}

	for (const entry of record.packages) {
		if (!present.includes(entry.tarball)) {
			problems.push(`${entry.name}: the release manifest names ${entry.tarball}, which is not here`)
			continue
		}

		const digest = digestFile(join(directory, entry.tarball))
		if (digest !== entry.sha512) {
			problems.push(
				`${entry.name}: ${entry.tarball} hashes to ${digest}, and the release manifest records ${entry.sha512}`
			)
		}
	}

	return problems
}

/**
 * Compares what each tarball says about itself against what the record claims.
 *
 * Matching digests prove only that the bytes are the ones the packing job
 * recorded, and that job ran an install and a build. This reads the
 * `package.json` npm itself would read on publish, so a tarball that would go
 * live under another name, another version, or as a private package stops the
 * release even when its digest is exactly as recorded.
 */
export function verifyPackedIdentities(directory: string, record: ReleaseRecord): string[] {
	const problems: string[] = []

	for (const entry of record.packages) {
		const path = join(directory, entry.tarball)

		let packed
		try {
			packed = readPackedManifest(path)
		} catch (error) {
			problems.push(`${entry.name}: ${(error as Error).message}`)
			continue
		}

		if (packed.name !== entry.name) {
			problems.push(
				`${entry.tarball} publishes as ${String(packed.name)}, and the release manifest calls it ${entry.name}`
			)
		}
		if (packed.version !== entry.version) {
			problems.push(`${entry.name} is packed at ${String(packed.version)}, and the release is ${entry.version}`)
		}
		if (packed.private === true) {
			problems.push(`${entry.name} is packed with private: true, so npm would refuse it`)
		}
	}

	return problems
}

/**
 * What a release manifest must say about the release contract it came from.
 *
 * The contract is read from the tagged commit, which is reviewed content; the
 * record is written by a job that executed dependency code. Holding one to the
 * other is what makes the record's package set a fact rather than a claim.
 */
export function contractProblems(record: ReleaseRecord, contract: { jsVersion: string; packages: string[] }): string[] {
	const problems: string[] = []

	if (record.jsVersion !== contract.jsVersion) {
		problems.push(`the release manifest is for ${record.jsVersion}, and format-release.json says ${contract.jsVersion}`)
	}

	if (contract.packages.length !== PUBLISH_SURFACE_SIZE) {
		problems.push(
			`format-release.json names ${contract.packages.length} packages and a release publishes ${PUBLISH_SURFACE_SIZE}`
		)
	}

	const recorded = new Set(record.packages.map(entry => entry.name))
	const listed = new Set(contract.packages)

	const missing = contract.packages.filter(name => !recorded.has(name))
	const extra = record.packages.map(entry => entry.name).filter(name => !listed.has(name))

	if (missing.length > 0)
		problems.push(`the release manifest omits ${missing.join(', ')}, which the contract publishes`)
	if (extra.length > 0)
		problems.push(`the release manifest carries ${extra.join(', ')}, which the contract does not publish`)

	return problems
}
