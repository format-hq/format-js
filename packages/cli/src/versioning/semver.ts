// The version pin must be exact — never a range. Prerelease and build
// suffixes are allowed so internal test releases can be pinned too.
const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

export function isExactVersion(version: string): boolean {
	return EXACT_SEMVER.test(version)
}

interface ParsedVersion {
	major: number
	minor: number
	patch: number
	hasPrerelease: boolean
}

export function parseVersion(version: string): ParsedVersion | null {
	const match = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?/.exec(version)

	if (!match) {
		return null
	}

	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		hasPrerelease: match[4] !== undefined
	}
}

// A pragmatic "is `candidate` a newer release than `current`" for the update
// nudge — not full semver precedence. Compares major/minor/patch numerically;
// on a tie, a plain release outranks a prerelease of the same numbers. Deep
// prerelease-identifier ordering isn't needed for a best-effort heads-up.
export function isNewer(candidate: string, current: string): boolean {
	const next = parseVersion(candidate)
	const now = parseVersion(current)

	if (!next || !now) {
		return false
	}

	if (next.major !== now.major) {
		return next.major > now.major
	}

	if (next.minor !== now.minor) {
		return next.minor > now.minor
	}

	if (next.patch !== now.patch) {
		return next.patch > now.patch
	}

	return now.hasPrerelease && !next.hasPrerelease
}

// Whether moving `from` → `to` may include breaking changes. A major bump
// always qualifies. Below 1.0, a minor bump does too: pre-1.0 the minor is the
// effective breaking axis (the convention npm's caret range encodes).
export function mayHaveBreakingChanges(from: string, to: string): boolean {
	const before = parseVersion(from)
	const after = parseVersion(to)

	if (!before || !after) {
		return false
	}

	if (after.major > before.major) {
		return true
	}

	return before.major === 0 && after.minor > before.minor
}
