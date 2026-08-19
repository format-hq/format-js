import { getLockstepStatus } from '@format.dev/cli/lockstep'

import { logger } from './log'

/**
 * Best-effort compile-time lockstep warning for the non-Studio paths (`format
 * compile` and the bundler plugins). Studio blocks on drift at boot; here we
 * only warn, so a drifted-but-not-yet-updated project still compiles.
 *
 * Uses the CLI's lockstep check so config.version stays the single source of
 * truth across every path.
 */
export async function warnOnLockstepDrift(cwd: string): Promise<void> {
	const { pinnedVersion, mismatches } = await getLockstepStatus(cwd)

	if (!pinnedVersion || mismatches.length === 0) {
		return
	}

	logger.warn(`Some installed Format packages do not match config.version (${pinnedVersion}):`)

	for (const mismatch of mismatches) {
		logger.warn(`  ${mismatch.name}  ${mismatch.actual} (expected ${mismatch.expected})`)
	}

	logger.warn('Run `format update` to bring everything in line.')
}
