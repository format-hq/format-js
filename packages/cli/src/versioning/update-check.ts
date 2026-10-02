import fs from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'

import { fetchLatestVersion } from './registry.ts'
import { isNewer, mayHaveBreakingChanges } from './semver.ts'

const CACHE_FILE_NAME = 'update-check.json'
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const CHANGELOG_URL = 'https://format.dev/changelog'

interface UpdateCache {
	checkedAt: number
	latest: string
}

// XDG_CACHE_HOME is honoured first so tests (and users who set it) can redirect
// the cache; otherwise the platform's conventional cache location.
function cacheDir(): string {
	const home = os.homedir()

	if (process.env.XDG_CACHE_HOME) {
		return join(process.env.XDG_CACHE_HOME, 'format')
	}

	if (process.platform === 'darwin') {
		return join(home, 'Library', 'Caches', 'format')
	}

	if (process.platform === 'win32') {
		return join(process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'format')
	}

	return join(home, '.cache', 'format')
}

function cacheFilePath(): string {
	return join(cacheDir(), CACHE_FILE_NAME)
}

async function readCache(): Promise<UpdateCache | null> {
	try {
		const raw = await fs.readFile(cacheFilePath(), 'utf8')
		const parsed = JSON.parse(raw) as Partial<UpdateCache>

		if (typeof parsed.checkedAt !== 'number' || typeof parsed.latest !== 'string') {
			return null
		}

		return { checkedAt: parsed.checkedAt, latest: parsed.latest }
	} catch {
		return null
	}
}

async function writeCache(latest: string): Promise<void> {
	try {
		await fs.mkdir(cacheDir(), { recursive: true })
		const cache: UpdateCache = { checkedAt: Date.now(), latest }
		await fs.writeFile(cacheFilePath(), `${JSON.stringify(cache)}\n`, 'utf8')
	} catch {
		// Best-effort: an unwritable cache just means we check again next time.
	}
}

// Resolve the latest release, preferring a fresh cache entry so we don't hit
// the registry on every run. A stale or missing cache triggers a fetch that
// also refreshes the cache. Returns null when offline or on any error — the
// check never fails a command.
async function resolveLatest(): Promise<string | null> {
	const cached = await readCache()

	if (cached && Date.now() - cached.checkedAt < CACHE_MAX_AGE_MS) {
		return cached.latest
	}

	try {
		const latest = await fetchLatestVersion()
		await writeCache(latest)

		return latest
	} catch {
		// Fall back to a stale cached value if we have one, else give up quietly.
		return cached?.latest ?? null
	}
}

function printNudge(pinnedVersion: string, latest: string): void {
	console.log('')
	console.log(`A newer Format release is available: ${latest} (you're on ${pinnedVersion}).`)

	if (mayHaveBreakingChanges(pinnedVersion, latest)) {
		console.log(`This release may include breaking changes. See ${CHANGELOG_URL} before updating.`)
	}

	console.log('Run `format update latest` to move to it.')
}

// Blocking check for commands the user invoked to ask (e.g. `format version`).
export async function reportNewerRelease(pinnedVersion: string): Promise<void> {
	const latest = await resolveLatest()

	if (latest && isNewer(latest, pinnedVersion)) {
		printNudge(pinnedVersion, latest)
	}
}

export interface DeferredUpdateCheck {
	report: () => Promise<void>
}

// Non-blocking check for long-running commands (`format dev`): kick off the
// resolve now — it has the whole session to complete and refresh the cache —
// and print the nudge later, once the command's output is done. Studio's dev
// server clears the terminal on start, so an up-front print would be wiped;
// reporting on exit is the reliable surface.
export function startUpdateCheck(pinnedVersion: string): DeferredUpdateCheck {
	const pending = resolveLatest().catch(() => null)

	return {
		report: async () => {
			const latest = await pending

			if (latest && isNewer(latest, pinnedVersion)) {
				printNudge(pinnedVersion, latest)
			}
		}
	}
}
