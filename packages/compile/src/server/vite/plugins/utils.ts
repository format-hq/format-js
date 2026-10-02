const DEFAULT_STYLE_EXTENSIONS = ['.css']

export function getStyleIdInfo(id: string, extensions: string[] = DEFAULT_STYLE_EXTENSIONS) {
	const cleanId = id.split('?')[0]
	const isCssFile = extensions.some(ext => cleanId.endsWith(ext))
	const isVueStyleRequest = id.includes('type=style')

	return { cleanId, isCssFile, isVueStyleRequest }
}
