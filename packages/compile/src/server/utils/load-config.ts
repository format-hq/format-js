import type { FormatConfig, Framework } from '../../shared/types'

import { existsSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { findConfigPath, readConfigFile } from '@format.dev/cli/config'

import { logger } from './log'
import { setUserProjectDir } from '../project/user-project-dir'
import { SUPPORTED_FRAMEWORKS, KNOWN_CONFIG_KEYS } from '../../shared/types/public/config'
import { CONFIG_FILE_NAME, NO_CONFIG_FILE_MESSAGE, INVALID_FRAMEWORK_MESSAGE, CONFIG_DOCS_URL } from '../constants'
import { CompileError } from '../errors'
import { suggestSimilar } from './suggest-similar'

interface FormatConfigResult {
	config: FormatConfig
	filepath: string
}

function isValidFramework(type: string): type is Framework {
	return SUPPORTED_FRAMEWORKS.includes(type as Framework)
}

// Known keys that contain (or are contained by) the unknown key, ignoring
// case. This catches typos edit distance misses, such as `assetsDir` for
// `sharedAssetsDir`, where the correct key just has an extra prefix.
function containmentMatches(key: string): string[] {
	const lowerKey = key.toLowerCase()

	return KNOWN_CONFIG_KEYS.filter(candidate => {
		const lowerCandidate = candidate.toLowerCase()

		return lowerCandidate.includes(lowerKey) || lowerKey.includes(lowerCandidate)
	})
}

// Suggest the known key(s) most likely intended for a mistyped one. Edit
// distance handles ordinary typos (e.g `framwork`); the containment fallback
// handles keys that are a substring of the real one (`assetsDir`).
function suggestConfigKeys(key: string): string[] {
	const editMatches = suggestSimilar({ word: key, candidates: KNOWN_CONFIG_KEYS })

	if (editMatches.length > 0) {
		return editMatches
	}

	// Only fall back for keys long enough that a substring match is meaningful,
	// otherwise short fragments like `dir` would match several keys.
	if (key.length < 4) {
		return []
	}

	return containmentMatches(key)
}

// Build a warning for every config key we don't recognise. These are almost
// always typos (e.g. `assetsDir` for `sharedAssetsDir`), so we point at the
// closest known key. Returned as strings rather than logged directly so callers
// that clear the screen at startup (the dev server) can surface them after the
// clear, once the console is settled.
export function getUnknownConfigKeyWarnings(config: FormatConfig): string[] {
	const unknownKeys = Object.keys(config).filter(key => !KNOWN_CONFIG_KEYS.includes(key as keyof FormatConfig))

	return unknownKeys.map(key => {
		const suggestions = suggestConfigKeys(key)
		const didYouMean = suggestions.length > 0 ? ` Did you mean "${suggestions.join('" or "')}"?` : ''

		return `Unknown option "${key}" in your Format config.${didYouMean} See ${CONFIG_DOCS_URL}`
	})
}

// Log unknown-key warnings immediately. This never throws: an unknown optional
// key shouldn't stop Studio booting, and a missing required key is reported
// separately.
function warnUnknownConfigKeys(config: FormatConfig) {
	for (const warning of getUnknownConfigKeyWarnings(config)) {
		logger.warn(warning)
	}
}

export async function loadConfig(configPath?: string | null): Promise<FormatConfigResult> {
	const filepath = configPath ? resolvePath(configPath) : findFormatConfigPath(process.cwd())

	if (!filepath || !existsSync(filepath)) {
		throw new CompileError(NO_CONFIG_FILE_MESSAGE)
	}

	let config: FormatConfig

	try {
		const result = await readConfigFile(filepath)
		config = result.config as unknown as FormatConfig
	} catch (error) {
		const message = error instanceof Error ? error.message : NO_CONFIG_FILE_MESSAGE

		throw new CompileError(message)
	}

	warnUnknownConfigKeys(config)

	if (!config.framework) {
		throw new CompileError(INVALID_FRAMEWORK_MESSAGE)
	}

	if (!isValidFramework(config.framework)) {
		throw new CompileError(INVALID_FRAMEWORK_MESSAGE)
	}

	const configDir = dirname(filepath)
	const baseDir = config.cwd ? resolvePath(configDir, config.cwd) : configDir
	setUserProjectDir(baseDir)

	return { config, filepath }
}

// Locate the Format config file on disk, searching up from the project root.
// Used directly by callers that need to amend the config (e.g. Panda setup).
// Delegates to the shared finder in @format.dev/cli, honouring the test-only
// FMT_CONFIG_FILE_NAME base-name override.
export function findFormatConfigPath(projectRoot: string): string | null {
	return findConfigPath(projectRoot, { baseName: CONFIG_FILE_NAME })
}
