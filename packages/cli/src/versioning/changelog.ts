import { isNewer } from './semver.ts'

export const CHANGELOG_URL = 'https://format.dev/changelog'

// The web publishes this index; each entry carries its own URL, so entry pages
// can move without breaking CLIs that are already installed. FMT_CHANGELOG_INDEX_URL
// points it at a local web server for tests and local runs.
const CHANGELOG_INDEX_URL = process.env.FMT_CHANGELOG_INDEX_URL ?? 'https://format.dev/changelog.json'
const FETCH_TIMEOUT_MS = 3_000

export interface ChangelogIndexEntry {
	version: string
	title: string
	url: string
}

interface ChangelogIndex {
	entries: ChangelogIndexEntry[]
}

interface ChangelogRangeArgs {
	entries: ChangelogIndexEntry[]
	fromVersion: string
	toVersion: string
}

// Entries after the version the project was on, up to and including the one it
// moved to, oldest first. Empty for a downgrade.
export function changelogEntriesBetween(args: ChangelogRangeArgs): ChangelogIndexEntry[] {
	const { entries, fromVersion, toVersion } = args

	return entries
		.filter(entry => isNewer(entry.version, fromVersion) && !isNewer(entry.version, toVersion))
		.sort((a, b) => (isNewer(a.version, b.version) ? 1 : -1))
}

async function fetchChangelogIndex(): Promise<ChangelogIndexEntry[]> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

	try {
		const response = await fetch(CHANGELOG_INDEX_URL, { signal: controller.signal })

		if (!response.ok) {
			throw new Error(`Changelog index returned ${response.status}`)
		}

		const index = (await response.json()) as ChangelogIndex

		return index.entries
	} finally {
		clearTimeout(timeout)
	}
}

interface ReportChangelogArgs {
	fromVersion: string
	toVersion: string
	fetchEntries?: () => Promise<ChangelogIndexEntry[]>
}

// The lines `format update` prints after moving versions. Best effort: when the
// index can't be read, point at the changelog page instead of failing an update
// that already succeeded.
export async function changelogLines(args: ReportChangelogArgs): Promise<string[]> {
	const { fromVersion, toVersion, fetchEntries = fetchChangelogIndex } = args

	const entries = await fetchEntries().catch(() => null)

	if (!entries) {
		return [`See what's changed: ${CHANGELOG_URL}`]
	}

	const inRange = changelogEntriesBetween({ entries, fromVersion, toVersion })

	if (inRange.length === 0) {
		return []
	}

	return [`What's changed since ${fromVersion}:`, ...inRange.map(entry => `  ${entry.version}  ${entry.url}`)]
}
