import type { FormatConfig } from '../../../shared/types'
import type { FormatNextPluginOptions } from '../../../shared/types/public/nextjs'

import { watch, type FSWatcher } from 'node:fs'
import { generateEntry } from './generate-entry'
import { logger } from '../../utils/log'
import { getDocumentsDir } from '../../project/paths'

const DEBOUNCE_MS = 1500

export function startWatcher(config: FormatConfig, options: FormatNextPluginOptions): FSWatcher {
	const documentsDir = getDocumentsDir(config)
	let debounceTimer: ReturnType<typeof setTimeout> | null = null
	let isRecompiling = false

	const recompile = async () => {
		if (isRecompiling) {
			return
		}

		isRecompiling = true

		try {
			logger.info('Document changed. Recompiling started...')
			await generateEntry(config, { ...options, clean: false })
			logger.info('Recompile completed. Bundles are ready.')
		} catch (error) {
			logger.error('Recompile failed.', error)
		} finally {
			isRecompiling = false
		}
	}

	const watcher = watch(documentsDir, { recursive: true }, (_event, filename) => {
		if (!filename) {
			return
		}

		if (debounceTimer) {
			clearTimeout(debounceTimer)
		}

		debounceTimer = setTimeout(recompile, DEBOUNCE_MS)
	})

	const cleanup = () => {
		watcher.close()

		if (debounceTimer) {
			clearTimeout(debounceTimer)
		}
	}

	process.once('SIGINT', cleanup)
	process.once('SIGTERM', cleanup)

	logger.debug(`Watching ${documentsDir} for document changes`)

	return watcher
}
