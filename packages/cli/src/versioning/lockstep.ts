import type { DependencyMismatch } from './deps.ts'

import { loadProjectState } from '../project.ts'

export type { DependencyMismatch }

export interface LockstepStatus {
	// The version pinned in format.config.json, or null when there's no
	// resolvable config or version field.
	pinnedVersion: string | null
	// Installed @format.dev/* dependencies whose version doesn't match pinnedVersion.
	mismatches: DependencyMismatch[]
}

/**
 * The lockstep check behind `format version`, exposed as a library call so
 * Studio and the compiler validate against the same source of truth —
 * config.version — instead of each reimplementing it.
 *
 * Non-throwing: returns `pinnedVersion: null` when there's no resolvable config,
 * so the caller decides whether that's fatal (Studio boot) or a skipped warning
 * (a compile run outside a project).
 */
export async function getLockstepStatus(cwd: string): Promise<LockstepStatus> {
	try {
		const state = await loadProjectState(cwd)

		return { pinnedVersion: state.pinnedVersion, mismatches: state.mismatches }
	} catch {
		return { pinnedVersion: null, mismatches: [] }
	}
}
