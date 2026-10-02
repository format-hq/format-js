import type { OutputBundle, OutputChunk, OutputAsset } from 'rolldown'
import { ENTRY_CSS_FILES_REPLACEMENT, STYLES_BY_FILE_REPLACEMENT } from '../../compile/constants'
import { logger } from '../../utils'

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replacePlaceholder(code: string, placeholder: string, replacement: string) {
	const literalRe = new RegExp('([\'"`])' + escapeRegExp(placeholder) + '\\1', 'g')
	return code.replace(literalRe, replacement)
}

function isAsset(item: any): item is OutputAsset {
	return item.type === 'asset'
}

function isChunk(item: any): item is OutputChunk {
	return item.type === 'chunk'
}

function collectCssForEntry(args: {
	entry: OutputChunk
	chunksByFileName: Map<string, OutputChunk>
	stylesByFile: Map<string, string>
}): string[] {
	// Walk the entry's chunk graph to include shared CSS from imported chunks.
	const { entry, chunksByFileName, stylesByFile } = args
	const orderedCss: string[] = []
	const seenCss = new Set<string>()
	const seenChunks = new Set<string>()
	const stack = [entry.fileName]

	while (stack.length) {
		const fileName = stack.pop()!
		if (seenChunks.has(fileName)) {
			continue
		}

		seenChunks.add(fileName)

		const chunk = chunksByFileName.get(fileName)
		if (!chunk) {
			continue
		}

		const importedCss = (chunk as any)?.viteMetadata?.importedCss as Set<string> | undefined
		if (importedCss) {
			for (const cssFile of importedCss) {
				// Only include CSS we captured from the bundle output.
				if (!stylesByFile.has(cssFile)) {
					continue
				}
				if (seenCss.has(cssFile)) {
					continue
				}
				seenCss.add(cssFile)
				orderedCss.push(cssFile)
			}
		}

		for (const next of [...chunk.imports, ...chunk.dynamicImports]) {
			stack.push(next)
		}
	}

	if (orderedCss.length === 0) {
		// Fallback to all CSS when Vite doesn't report importedCss.
		return [...stylesByFile.keys()]
	}

	return orderedCss
}

/*
Post-build, gather CSS assets and fill virtual styles placeholders.
*/

export function getStyles() {
	const stylesByFile = new Map<string, string>()

	return {
		name: 'get-styles',
		apply: 'build',
		enforce: 'post',

		generateBundle(_outputOptions: { format?: string }, bundle: OutputBundle) {
			stylesByFile.clear()
			const entryCssFiles = new Map<string, string[]>()

			for (const [fileName, item] of Object.entries(bundle)) {
				// Should just be the generated style.css file from rollup
				const isCssFile = isAsset(item) && fileName.endsWith('.css')

				if (isCssFile) {
					const cleanedSource = String(item.source ?? '').replace(
						/\/\*\$vite\$\:\d+\*\/\s*$/, // Targets the vite comment marker at the end of the file
						''
					)

					stylesByFile.set(fileName, cleanedSource)
				}
			}

			const chunksByFileName = new Map<string, OutputChunk>()

			for (const [fileName, item] of Object.entries(bundle)) {
				if (isChunk(item)) {
					// Map for fast graph traversal.
					chunksByFileName.set(fileName, item)
				}
			}

			for (const item of Object.values(bundle)) {
				if (isChunk(item) && item.isEntry) {
					const cssFiles = collectCssForEntry({ entry: item, chunksByFileName, stylesByFile })
					entryCssFiles.set(item.name, cssFiles)
				}
			}

			const stylesByFileObj: Record<string, string> = {}
			const entryCssFilesObj: Record<string, string[]> = {}

			for (const [fileName, styles] of stylesByFile) {
				stylesByFileObj[fileName] = styles
			}

			for (const [entryName, files] of entryCssFiles) {
				entryCssFilesObj[entryName] = files
			}

			const stylesByFileReplacement = JSON.stringify(stylesByFileObj)
			const entryCssFilesReplacement = JSON.stringify(entryCssFilesObj)

			for (const item of Object.values(bundle)) {
				if (!isChunk(item) || typeof item.code !== 'string') {
					continue
				}

				// Replace placeholders in the virtual:styles module chunk.

				if (item.code.includes(STYLES_BY_FILE_REPLACEMENT)) {
					item.code = replacePlaceholder(item.code, STYLES_BY_FILE_REPLACEMENT, stylesByFileReplacement)
				}

				if (item.code.includes(ENTRY_CSS_FILES_REPLACEMENT)) {
					item.code = replacePlaceholder(item.code, ENTRY_CSS_FILES_REPLACEMENT, entryCssFilesReplacement)
				}
			}

			logger.debug('Collected CSS assets', {
				cssFiles: stylesByFile.size,
				entries: entryCssFiles.size
			})

			for (const fileName of stylesByFile.keys()) {
				delete bundle[fileName]
			}
		}
	}
}
