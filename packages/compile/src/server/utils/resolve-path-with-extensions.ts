import fs from 'fs/promises'
import { join, resolve } from 'path'
import { logger } from './log'

interface ResolvePathWithExtensionsOptions {
	path: string
	fileName: string
	extensions: string[]
}

/**
 * Finds the first matching file from a list of extensions.
 * Performs fs.access on each candidate path in parallel and returns the first match.
 * If multiple matches are found, returns the first but logs a warning about duplicates.
 *
 * @param options - The search options
 * @param options.path - The base directory path
 * @param options.fileName - The file name (without extension)
 * @param options.extensions - Array of extensions to check (e.g. ['.tsx', '.ts', '.js'])
 * @returns The full absolute path to the first matching file or null if no matching files are found
 */

export async function resolvePathWithExtensions(options: ResolvePathWithExtensionsOptions): Promise<string | null> {
	const { path, fileName, extensions } = options

	const potentialFiles = extensions.map(ext => join(path, `${fileName}${ext}`))

	const filePaths = (
		await Promise.all(
			potentialFiles.map(async path => {
				try {
					await fs.access(path)
					return path
				} catch {
					return null
				}
			})
		)
	).filter((path): path is string => Boolean(path))

	const noFileFound = filePaths.length === 0

	if (noFileFound) {
		const expected = extensions.map(ext => `${fileName}${ext}`).join(', ')
		throw new Error(`No "${fileName}" file found in "${path}". Expected one of: ${expected}`)
	}

	const filePath = filePaths[0]

	const multipleFilesFound = filePaths.length > 1

	if (multipleFilesFound) {
		logger.warn(
			`Warning: Multiple "${fileName}" files found in "${path}". Pick one extension and remove the others. Using ${filePath}`
		)
	}

	return resolve(filePath)
}
