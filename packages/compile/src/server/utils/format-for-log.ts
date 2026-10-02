const compactLog = (value: string) => value.replace(/\s+/g, '').trim()

export const formatForLog = async (value: string, parser: 'html' | 'css') => {
	try {
		const prettier = await import('prettier')
		return await prettier.default.format(value, { parser, printWidth: 200, htmlWhitespaceSensitivity: 'ignore' })
	} catch {
		return compactLog(value)
	}
}
