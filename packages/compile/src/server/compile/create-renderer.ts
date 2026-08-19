// @ts-ignore
import adaptor from 'virtual:adaptor'

// @ts-ignore
import validate from 'virtual:validate'

// @ts-ignore
import { decodeStyleEntities } from 'virtual:decode-style-entities'

// @ts-ignore
import { sanitizeHtml } from 'virtual:sanitize-html'

import { finalizeDocumentHtml } from './finalize-document-html'

declare const _FMT_VALIDATE_SCHEMA_: boolean
declare const _FMT_ENGINE_VERSION_: string

type CreateRendererInput = {
	Component: any
	schema?: any
	styles?: string
}

class FormatRenderError extends Error {
	public data: any

	constructor(data = {}, ...params: any[]) {
		super(...params)

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, FormatRenderError)
		}

		this.message = [this.message, 'See error.data for more details'].join(' ')
		this.name = 'FormatRenderError'
		this.data = data
	}
}

export function createRenderer({ Component, schema, styles }: CreateRendererInput) {
	const stylesText = typeof styles === 'string' ? styles : ''

	const render = async (data: any, cwd: string): Promise<string> => {
		if (_FMT_VALIDATE_SCHEMA_ && schema) {
			const validation = await validate(schema, data)

			if (!validation.ok) {
				throw new FormatRenderError({ issues: validation.errors }, 'Schema validation failed.', {
					cause: 'ERROR_SCHEMA_VALIDATION'
				})
			}
			data = validation.data
		}

		const engine = _FMT_ENGINE_VERSION_

		try {
			const element = await adaptor.create({ Component, data, cwd })
			const html = await adaptor.render({ engine, element, cwd })

			let out = finalizeDocumentHtml({ html, engine, css: stylesText })
			out = decodeStyleEntities(out)
			out = sanitizeHtml(out)

			return out
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new FormatRenderError({ error }, errorMessage, { cause: 'ERROR_RENDER' })
		}
	}

	return { render }
}

export default createRenderer
