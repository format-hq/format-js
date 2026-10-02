import type { FormatConfigFile } from './config.ts'
import type { FormatDependency, DependencyMismatch } from './versioning/deps.ts'

import { dirname } from 'node:path'

import { findConfigPath, readConfigFile } from './config.ts'
import { packageJsonPathFor, scanFormatDependencies, findMismatches } from './versioning/deps.ts'
import { isExactVersion } from './versioning/semver.ts'
import { CliError } from './errors.ts'

export interface ProjectState {
	configFile: FormatConfigFile
	projectDir: string
	pinnedVersion: string | null
	packageJsonPath: string | null
	dependencies: FormatDependency[]
	mismatches: DependencyMismatch[]
}

export const NO_CONFIG_MESSAGE =
	'Could not find a Format config file. It should be named format.config.{json|jsonc} and placed in the root of your repo. Run `npm create format` to start a new project.'

// Everything the version commands need to know about the current project:
// where the config is, what version it pins, and whether the installed
// Format packages agree with it.
export async function loadProjectState(startDir: string): Promise<ProjectState> {
	// FMT_CONFIG_FILE_NAME is the internal base-name override Studio's test
	// fixtures use; the CLI honours it so delegated commands find the same file.
	const configPath = findConfigPath(startDir, { baseName: process.env.FMT_CONFIG_FILE_NAME })

	if (!configPath) {
		throw new CliError(NO_CONFIG_MESSAGE)
	}

	const configFile = await readConfigFile(configPath)
	const projectDir = dirname(configPath)

	const rawVersion = configFile.config.version
	const pinnedVersion = typeof rawVersion === 'string' ? rawVersion : null

	if (pinnedVersion && !isExactVersion(pinnedVersion)) {
		throw new CliError(
			`Invalid "version" in ${configPath}: "${pinnedVersion}". It must be an exact version like "0.1.2" — ranges are not supported.`
		)
	}

	const packageJsonPath = packageJsonPathFor(configPath)
	const dependencies = packageJsonPath ? await scanFormatDependencies(packageJsonPath) : []
	const mismatches = pinnedVersion ? findMismatches({ pinnedVersion, dependencies }) : []

	return { configFile, projectDir, pinnedVersion, packageJsonPath, dependencies, mismatches }
}
