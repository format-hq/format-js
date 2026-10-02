export type { FormatNextPluginOptions, FormatTargetOptions, FormatRenderer } from '../../../shared/types/public/nextjs'
import type { FormatNextPluginOptions } from '../../../shared/types/public/nextjs'

import { resolve, relative } from 'node:path'
import { readFile } from 'node:fs/promises'
import { loadConfig } from '../../utils/load-config'
import { resolveBundleName } from '../../compile/bundle-name'
import { generateEntry, type GenerateEntryResult } from './generate-entry'
import { startWatcher } from './watcher'
import { logger, setLogLevel } from '../../utils/log'
import { parseLogLevelFromEnv } from '../../utils/env-var'

async function readExternals(outDir: string, targets: string[]): Promise<string[]> {
	const allExternals = new Set<string>()

	for (const target of targets) {
		if (target !== 'node') {
			continue
		}

		const externalsPath = resolve(outDir, target, 'externals.json')

		try {
			const raw = await readFile(externalsPath, 'utf-8')
			const parsed = JSON.parse(raw) as { externals?: string[] }

			for (const pkg of parsed.externals ?? []) {
				allExternals.add(pkg)
			}
		} catch {
			// externals.json may not exist yet on first build
		}
	}

	return [...allExternals]
}

let entryPromise: Promise<GenerateEntryResult> | null = null
let watcherStarted = false

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function withFormat(formatOptions: FormatNextPluginOptions = {}): (nextConfig?: any) => Promise<any> {
	return async (nextConfig: any = {}) => {
		setLogLevel(parseLogLevelFromEnv())

		const bundleName = resolveBundleName(formatOptions.bundleName)

		logger.debug(`withFormat initializing (bundle: format:${bundleName})`)

		const { config } = await loadConfig(formatOptions.configPath)

		if (!entryPromise) {
			entryPromise = generateEntry(config, formatOptions)
		}

		const { entries, outDir } = await entryPromise

		const isDev = process.env.NODE_ENV !== 'production'

		if (isDev && !watcherStarted) {
			watcherStarted = true
			startWatcher(config, formatOptions)
		}

		const projectRoot = process.cwd()
		const relativeOutDir = `./${relative(projectRoot, outDir).replace(/\\/g, '/')}`

		const webpackAliases: Record<string, string> = {}
		const turbopackAliases: Record<string, string> = {}

		for (const entry of entries) {
			const relativePath = `./${relative(projectRoot, entry.entryPath).replace(/\\/g, '/')}`

			for (const alias of entry.aliasKeys) {
				webpackAliases[alias] = entry.entryPath
				turbopackAliases[alias] = relativePath
			}
		}

		const targetNames = entries.map(e => e.target)
		const detectedExternals = await readExternals(outDir, targetNames)

		// Next.js manages React resolution internally (server builds, RSC layers, etc).
		// Adding react/react-dom to serverExternalPackages bypasses that and breaks hooks.
		const nextManagedPackages = new Set(['react', 'react-dom'])
		const safeExternals = detectedExternals.filter(pkg => !nextManagedPackages.has(pkg))

		const existingWebpack = nextConfig.webpack as ((...args: unknown[]) => unknown) | undefined

		return {
			...nextConfig,

			webpack(webpackConfig: Record<string, unknown>, webpackContext: unknown) {
				const resolveConfig = (webpackConfig.resolve ?? {}) as Record<string, unknown>
				const existingAlias = (resolveConfig.alias ?? {}) as Record<string, string>

				webpackConfig.resolve = {
					...resolveConfig,
					alias: {
						...existingAlias,
						...webpackAliases
					}
				}

				if (existingWebpack) {
					return existingWebpack(webpackConfig, webpackContext)
				}

				return webpackConfig
			},

			turbopack: {
				...(nextConfig.turbopack ?? {}),
				resolveAlias: {
					...(nextConfig.turbopack?.resolveAlias ?? {}),
					...turbopackAliases
				}
			},

			serverExternalPackages: [...(nextConfig.serverExternalPackages ?? []), '@format.dev/compile', ...safeExternals],

			outputFileTracingIncludes: {
				...(nextConfig.outputFileTracingIncludes ?? {}),
				'/**': [`${relativeOutDir}/**/*`]
			}
		}
	}
}
