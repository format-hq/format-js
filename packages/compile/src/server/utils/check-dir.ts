import type { Stats } from 'node:fs'
import { stat } from 'node:fs/promises'
import { logger } from './log'

interface CheckDirResult {
	exists: boolean
	isDirectory: boolean
	stats: Stats | null
}

export async function checkDir(dir: string): Promise<CheckDirResult> {
	try {
		const stats = await stat(dir)

		return {
			exists: true,
			isDirectory: stats.isDirectory(),
			stats
		}
	} catch (err: any) {
		if (err.code === 'ENOENT') {
			return { exists: false, isDirectory: false, stats: null }
		}

		logger.error(`Error checking directory: ${dir}`, err)
		return { exists: false, isDirectory: false, stats: null }
	}
}
