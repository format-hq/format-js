/**
 * Reads and validates `format-release.json`, the release contract: the version
 * every published package carries, the engine version those packages target,
 * and the list of names that publish.
 *
 * This module is the one definition of what the file means. `set-js-version`
 * stamps from it and the release-contract test checks against it, so a
 * disagreement between them can only be a real disagreement, never two
 * readers parsing the same bytes differently.
 *
 * What it deliberately does NOT provide: the workspace's actual set of
 * publishable packages. The contract test derives that itself, by its own
 * traversal — if it reused the traversal `set-js-version` stamps with, a bug
 * in that traversal would make the stamper and its own check agree
 * incorrectly, and the cross-check would prove nothing.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseVersion } from './version.ts'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const MANIFEST_PATH = join(REPO_ROOT, 'format-release.json')

export interface ReleaseManifest {
	/** The version every published package carries. */
	jsVersion: string
	/** The engine version those packages target. Copied from Cargo, never hand-set. */
	engineTarget: string
	/** The publish surface — every name that releases at `jsVersion`. */
	packages: string[]
}

const FIELDS = ['jsVersion', 'engineTarget', 'packages'] as const

export class ReleaseManifestError extends Error {}

/**
 * Parse and validate a manifest from its text. Rejects anything that would
 * make a later stamp ambiguous — every field is required, versions are exact
 * semver, names are unique and non-empty, and unknown fields are refused so a
 * typo cannot sit unread in the file that governs a release.
 *
 * `path` names the file the text came from, and appears in every message. The
 * release tooling reads contracts from other trees as well as this one — a
 * generated mirror, a tagged snapshot — and an error naming the wrong file
 * sends whoever reads it to the wrong place.
 */
export function parseReleaseManifest(text: string, path: string = MANIFEST_PATH): ReleaseManifest {
	// Annotated on the binding, not just the arrow: the compiler narrows past a
	// call that never returns only when the name it was called through says so.
	const fail: (problem: string) => never = problem => {
		throw new ReleaseManifestError(`${path} is invalid: ${problem}`)
	}

	let raw: unknown
	try {
		raw = JSON.parse(text)
	} catch (error) {
		fail(`not valid JSON (${error instanceof Error ? error.message : String(error)})`)
	}

	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		fail('the top level must be an object')
	}

	const record = raw as Record<string, unknown>

	const unknown = Object.keys(record).filter(key => !FIELDS.includes(key as (typeof FIELDS)[number]))
	if (unknown.length > 0) {
		fail(`unknown field(s): ${unknown.join(', ')}. Allowed: ${FIELDS.join(', ')}`)
	}

	// One definition of a version across the release tooling: exact releases
	// only, so "which version shipped" is a fact rather than a question.
	for (const field of ['jsVersion', 'engineTarget'] as const) {
		const value = record[field]
		if (typeof value !== 'string' || parseVersion(value) === null) {
			fail(`${field} must be an exact version like "0.1.0", got ${JSON.stringify(value)}`)
		}
	}

	const packages = record.packages
	if (!Array.isArray(packages) || packages.length === 0) {
		fail('packages must be a non-empty array of package names')
	}

	for (const name of packages) {
		if (typeof name !== 'string' || name.trim() === '') {
			fail(`packages contains ${JSON.stringify(name)}; every entry must be a non-empty package name`)
		}
	}

	const duplicates = packages.filter((name, index) => packages.indexOf(name) !== index)
	if (duplicates.length > 0) {
		fail(`packages lists ${[...new Set(duplicates)].join(', ')} more than once`)
	}

	return {
		jsVersion: record.jsVersion as string,
		engineTarget: record.engineTarget as string,
		packages: packages as string[]
	}
}

/** Read and validate the repo's own manifest. */
export function readReleaseManifest(path: string = MANIFEST_PATH): ReleaseManifest {
	return parseReleaseManifest(readFileSync(path, 'utf8'), path)
}
