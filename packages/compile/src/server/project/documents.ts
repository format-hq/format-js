import type { Dirent } from 'node:fs'
import type { FormatConfig } from '../../shared/types/public/config'
import type { Document } from '../../shared/types'

import fs from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { DATA_VARIANTS_DIR, PROJECT_EXTENSIONS } from '../constants'
import { getDocumentsDir } from './paths'
import { readFile, resolvePathWithExtensions } from '../utils'
import { CompileError } from '../errors'
import { DEFAULT_VARIANT } from '../../shared/constants'
import { RESERVED_DOCUMENT_NAMES } from '../compile/constants'

interface GetUserDocumentIndexOptions {
	documentName: string
	config: FormatConfig
}

export const getDocumentDataDir = (documentName: string, config: FormatConfig): string => {
	const documentsDir = getDocumentsDir(config)
	return resolve(documentsDir, documentName, DATA_VARIANTS_DIR)
}

export const getDocumentDataVariantPath = (documentName: string, variant: string, config: FormatConfig): string => {
	return resolve(getDocumentDataDir(documentName, config), `${variant}.json`)
}

export async function getUserDocumentIndex(args: GetUserDocumentIndexOptions): Promise<string> {
	const { documentName, config } = args

	const documentsDir = getDocumentsDir(config)
	const path = join(documentsDir, documentName)
	const extensions = PROJECT_EXTENSIONS[config.framework] as string[]

	try {
		const indexPath = await resolvePathWithExtensions({
			fileName: 'index',
			extensions,
			path
		})

		if (!indexPath) {
			throw new CompileError(
				`No index entry point found for "${documentName}" in "${path}". Expected one of: ${extensions.map(ext => `index${ext}`).join(', ')}`
			)
		}

		return indexPath
	} catch (error) {
		if (error instanceof Error) {
			throw new CompileError(error.message)
		}
		throw error
	}
}

// Max mtime across the document's top-level files and its data variants — the
// surfaces an author actually edits. One shallow pass; nested asset trees are
// deliberately not walked (the dir mtime covers adds/removes at the top level).
export async function getDocumentLastModified(documentName: string, config: FormatConfig): Promise<number | null> {
	const documentsDir = getDocumentsDir(config)
	const documentDir = join(documentsDir, documentName)

	const safeStatMtime = async (path: string): Promise<number> => {
		try {
			const stats = await fs.stat(path)
			return stats.mtimeMs
		} catch {
			return 0
		}
	}

	try {
		const entries = await fs.readdir(documentDir, { withFileTypes: true })
		const targets = [
			documentDir,
			...entries.filter(entry => entry.isFile()).map(entry => join(documentDir, entry.name))
		]

		try {
			const dataDir = join(documentDir, DATA_VARIANTS_DIR)
			const dataEntries = await fs.readdir(dataDir, { withFileTypes: true })
			targets.push(...dataEntries.filter(entry => entry.isFile()).map(entry => join(dataDir, entry.name)))
		} catch {
			// No data dir yet.
		}

		const mtimes = await Promise.all(targets.map(safeStatMtime))
		const latest = Math.max(...mtimes)

		return latest > 0 ? Math.round(latest) : null
	} catch {
		return null
	}
}

async function getDocumentsDirs(config: FormatConfig): Promise<Dirent[] | null> {
	try {
		const documentsDir = getDocumentsDir(config)
		return await fs.readdir(documentsDir, { withFileTypes: true })
	} catch {
		return null
	}
}

export async function getDocuments(config: FormatConfig): Promise<Document[]> {
	const supportedExtensions = PROJECT_EXTENSIONS[config.framework]
	const documentDirs = await getDocumentsDirs(config)

	if (!documentDirs) {
		throw new CompileError(
			'No documents folder found. Please create a documents folder, then add a folder for each document and an index entry point file.'
		)
	}

	// A document compiles to its own `<name>/` dir at the bundle root, so a name
	// matching a reserved output dir (e.g. `shared-assets`, `chunks`) would clash.
	const reservedDir = documentDirs.find(
		dir => (dir.isDirectory() || dir.isSymbolicLink()) && RESERVED_DOCUMENT_NAMES.includes(dir.name)
	)

	if (reservedDir) {
		throw new CompileError(
			`"${reservedDir.name}" is a reserved name and can't be used for a document. ` +
				`Reserved names: ${RESERVED_DOCUMENT_NAMES.join(', ')}. Please rename the document folder.`
		)
	}

	const documents = await Promise.all(
		documentDirs
			.filter(dir => dir.isDirectory() || dir.isSymbolicLink())
			.map(async dir => {
				try {
					const indexPath = await getUserDocumentIndex({
						documentName: dir.name,
						config
					})

					// Extract extension from the full path
					const extension = supportedExtensions.find(ext => indexPath.endsWith(`index${ext}`))

					if (!extension) {
						return null
					}

					const [variants, lastModified] = await Promise.all([
						getDataVariants(dir.name, config),
						getDocumentLastModified(dir.name, config)
					])

					return {
						name: dir.name,
						variants,
						extension,
						lastModified
					}
				} catch {
					// Document doesn't have a valid index file, skip it
					return null
				}
			})
	)

	return documents.filter(Boolean) as Document[]
}

export async function getDataVariants(documentName: string, config: FormatConfig): Promise<string[]> {
	const dataDir = getDocumentDataDir(documentName, config)

	try {
		const files = await fs.readdir(dataDir, { withFileTypes: true })

		return files
			.filter(file => file.isFile() && file.name.endsWith('.json'))
			.map(file => file.name.replace('.json', ''))
			.sort((a, b) => {
				// Ensure default.json comes first
				if (a === DEFAULT_VARIANT) return -1
				if (b === DEFAULT_VARIANT) return 1
				return a.localeCompare(b)
			})
	} catch {
		// If data directory doesn't exist, return empty array
		return []
	}
}

/**
 * Get the data for a specific document and variant.
 */
export async function getDocumentDataFile(documentName: string, variant: string, config: FormatConfig): Promise<any> {
	const dataPath = getDocumentDataVariantPath(documentName, variant, config)
	const data = await readFile(dataPath)
	return data
}
