import { createLogger, type LogLevel as ViteLogLevel } from 'vite'

import vuePlugin from '@vitejs/plugin-vue'
import vueJsxPlugin from '@vitejs/plugin-vue-jsx'
import vueSvgPlugin from 'vite-svg-loader'
import reactSvgPlugin from 'vite-plugin-svgr'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import tailwindcssPlugin from '@tailwindcss/vite'
import wywPlugin from '@wyw-in-js/vite'
import autoprefixer from 'autoprefixer'

import { LogLevel } from '../../shared/types'
import { getLogLevel, logPrefix } from '../utils'
import { getUserProjectDir } from '../project/user-project-dir'
import { htmlLoader } from './plugins/html-loader'
import { SERVER_WATCH_IGNORE } from '../constants'
import { compileState } from '../runtime-state'

export function createConfig() {
	const config = compileState.getConfig()
	const { framework } = config

	const frameworkPlugins = []
	const stylePlugins = [
		vanillaExtractPlugin(),
		tailwindcssPlugin(),
		wywPlugin({
			exclude: SERVER_WATCH_IGNORE
		})
	]

	if (framework === 'html') {
		frameworkPlugins.push(htmlLoader())
	}

	if (framework === 'react') {
		frameworkPlugins.push(reactSvgPlugin({ include: '**/*.svg' }))
	}

	if (framework === 'vue') {
		frameworkPlugins.push(
			vuePlugin({
				template: {
					transformAssetUrls: {
						img: [] // Stops the vue plugin from automatically converting images to modules
					}
				}
			}),
			vueJsxPlugin(),
			vueSvgPlugin({ svgo: false }) as any
		)
	}

	// Only show vite logs when FORMAT_LOG_LEVEL=3 (debug) or FORMAT_DEBUG is true
	const viteLogLevel = getLogLevel() == LogLevel.DEBUG ? 'info' : 'silent'
	const baseViteLogger = createLogger('info', { prefix: logPrefix })
	const viteLogger = {
		...baseViteLogger,
		warn: (msg: string, options?: any) => {
			// Suppress dynamic import warnings for fetchEnginePath, as Bun always strips comments! So can't use /* vite-ignore */
			// This is a bit brittle, as it depends on the function name in the source code (client.ts). Oh well!
			if (
				typeof msg === 'string' &&
				msg.includes('dynamic import cannot be analyzed') &&
				msg.includes('fetchEnginePath')
			) {
				return
			}

			baseViteLogger.warn(msg, options)
		}
	}

	const baseViteConfig = {
		root: getUserProjectDir(),
		base: '/',
		css: {
			transformer: 'postcss' as const,
			postcss: {
				plugins: [autoprefixer({ overrideBrowserslist: ['last 2 versions'] })]
			}
		},
		appType: 'custom' as const,
		logLevel: viteLogLevel as ViteLogLevel,
		customLogger: viteLogger
	}

	return { baseViteConfig, frameworkPlugins, stylePlugins }
}
