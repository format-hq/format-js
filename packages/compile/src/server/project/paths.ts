import type { FormatConfig } from '../../shared/types/public/config'

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getUserProjectDir } from './user-project-dir'

export const DOT_TMP_DIR_NAME = '.tmp'
export const DEFAULT_OUT_DIR_NAME = '_generated'
export const DOT_FORMAT_DIR_NAME = '.format'

// The @format.dev/compile dist directory (when built). Two levels up because this
// module sits at server/project/ — keep in step if this file ever moves.
export const _dirname = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Affected by the `rootDir` config option
export const getRootDir = (config: FormatConfig): string => {
	return resolve(getUserProjectDir(), config.rootDir || './')
}

export function getDocumentsDir(config: FormatConfig): string {
	return join(getRootDir(config), DOCUMENTS_DIR_NAME)
}

export const SHARED_ASSETS_DIR_NAME = 'assets'

/**
 * The shared assets directory. Defaults to `assets/` under the root dir,
 * mirroring each document's own `./assets/` folder. An explicit
 * `sharedAssetsDir` resolves relative to the project directory, so it can sit
 * outside `rootDir`. The directory is not required to exist — callers check.
 */
export function getSharedAssetsDir(config: FormatConfig): string {
	if (config.sharedAssetsDir) {
		return join(getUserProjectDir(), config.sharedAssetsDir)
	}

	return join(getRootDir(config), SHARED_ASSETS_DIR_NAME)
}

export const DOCUMENTS_DIR_NAME = 'documents'
