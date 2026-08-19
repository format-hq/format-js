/**
 * Strict release versions. A release is one exact number — no ranges, no
 * prerelease tags, no build metadata, no leading zeroes — so this parser is
 * deliberately narrower than semver's grammar and is the only definition of a
 * version the release tooling uses.
 */

export type BumpKind = 'major' | 'minor' | 'patch'

export const BUMP_KINDS: BumpKind[] = ['major', 'minor', 'patch']

export interface Version {
	major: number
	minor: number
	patch: number
}

// No leading zeroes: "01.2.3" and "1.2.3" are different strings that npm would
// treat as one version, so accepting both invites a manifest and a registry
// that disagree about what shipped.
const EXACT = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function parseVersion(text: string): Version | null {
	const match = EXACT.exec(text)
	if (!match) return null

	const parts = [Number(match[1]), Number(match[2]), Number(match[3])]

	// Past 2^53 a decimal string and its Number are different values, so
	// "9007199254740993.0.0" would round to ...992 and stamp a version nobody
	// asked for. Refuse rather than silently alter the request.
	if (!parts.every(Number.isSafeInteger)) return null

	const [major, minor, patch] = parts
	return { major, minor, patch }
}

export function formatVersion(version: Version): string {
	return `${version.major}.${version.minor}.${version.patch}`
}

/** Negative when a is older, positive when a is newer, zero when equal. */
export function compareVersions(a: Version, b: Version): number {
	return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export class VersionError extends Error {}

export function bumpVersion(current: Version, kind: BumpKind): Version {
	const bumped =
		kind === 'major'
			? { major: current.major + 1, minor: 0, patch: 0 }
			: kind === 'minor'
				? { major: current.major, minor: current.minor + 1, patch: 0 }
				: { major: current.major, minor: current.minor, patch: current.patch + 1 }

	// a component one past the safe range would print as a number that no
	// longer round-trips through its own string
	const raised = kind === 'major' ? bumped.major : kind === 'minor' ? bumped.minor : bumped.patch
	if (!Number.isSafeInteger(raised)) {
		throw new VersionError(`bumping the ${kind} of ${formatVersion(current)} exceeds the safe integer range`)
	}

	return bumped
}

export function isBumpKind(value: string): value is BumpKind {
	return (BUMP_KINDS as string[]).includes(value)
}
