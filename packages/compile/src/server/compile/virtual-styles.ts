import { ENTRY_CSS_FILES_REPLACEMENT, STYLES_BY_FILE_REPLACEMENT } from './constants'

const stylesByFile = STYLES_BY_FILE_REPLACEMENT as unknown as Record<string, string>
const entryCssFiles = ENTRY_CSS_FILES_REPLACEMENT as unknown as Record<string, string[]>
const cache: Record<string, string> = Object.create(null)

export function getEntryStyles(entryName: string) {
	if (cache[entryName]) return cache[entryName]

	const files = entryCssFiles[entryName] || []
	let styles = ''

	for (const file of files) {
		styles += stylesByFile[file] || ''
	}

	cache[entryName] = styles
	return styles
}

export default getEntryStyles
