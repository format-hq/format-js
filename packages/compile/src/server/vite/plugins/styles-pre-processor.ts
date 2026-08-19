import type { Plugin } from 'vite'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import postcss from 'postcss'
import postcssImport from 'postcss-import'
import { logger } from '../../utils'
import { compileState } from '../../runtime-state'
import { CompileError } from '../../errors'
import { getUserProjectDir } from '../../project/user-project-dir'
import { getStyleIdInfo } from './utils'
import { postcssImportUrl } from './postcss/import-url'

// The user's own Panda installation processes their panda.config — Studio
// deliberately doesn't bundle a copy, so there is never a version mismatch
// between the config they wrote and the Panda that reads it. Panda projects
// should always have @pandacss/dev installed: either `format new project` adds
// it, or the user should have installed from following docs.
function loadUserPandaPostcssPlugin(): (options: Record<string, unknown>) => never {
	const projectDir = getUserProjectDir()

	try {
		const userRequire = createRequire(join(projectDir, 'package.json'))
		const plugin = userRequire('@pandacss/dev/postcss')

		return plugin.default ?? plugin
	} catch {
		throw new CompileError(
			'Your Format config enables Panda CSS, but @pandacss/dev is not installed in your project. Install it with `npm install -D @pandacss/dev` and try again.'
		)
	}
}

export async function stylesPreProcessor(inlineRemoteCss = false): Promise<Plugin> {
	const config = compileState.getConfig()
	const processor = postcss()

	if (config.pandaCss?.enabled) {
		const pandacssPlugin = loadUserPandaPostcssPlugin()
		const defaultPandaCssConfigPath = resolve(getUserProjectDir(), 'panda.config.ts')
		const { postCssConfig = {} } = config.pandaCss

		processor.use(
			pandacssPlugin({
				cwd: getUserProjectDir(),
				configPath: defaultPandaCssConfigPath,
				...postCssConfig
			})
		)
	}

	if (inlineRemoteCss) {
		processor.use(postcssImportUrl())
		processor.use(postcssImport())
	}

	return {
		name: 'styles-pre-processor',
		enforce: 'pre',
		async transform(code, id) {
			const { cleanId, isCssFile, isVueStyleRequest } = getStyleIdInfo(id)

			if (!isCssFile && !isVueStyleRequest) {
				return null
			}

			const result = await processor.process(code, { from: cleanId, map: false })

			if (result.css === code) {
				return null
			}

			result.messages.forEach(message => {
				if (message.type === 'warning') {
					logger.warn(message.text)
				}
			})

			return { code: result.css, map: null }
		}
	}
}
