import { defineConfig, defineProject, configDefaults } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBrowserCommands } from './test/utils/browser-commands'
// .ts extension: build/release typechecks under NodeNext, which requires one
import { releaseDefines } from '../../build/release/constants.ts'

const _dirname = resolve(fileURLToPath(new URL('.', import.meta.url)))
const testsPath = resolve(_dirname, 'test')
const unitTestsPath = join(testsPath, 'unit')
const compileTestsPath = join(testsPath, 'integration/compile')
const unpluginTestsPath = join(testsPath, 'integration/unplugin')
const nextjsTestsPath = join(testsPath, 'integration/nextjs')

const browserCommands = createBrowserCommands()

const createBrowserConfig = (projectName: string) => ({
	enabled: true,
	headless: true,
	provider: playwright(),
	instances: [{ browser: 'chromium' as const, name: `${projectName}-chromium` }],
	screenshotFailures: false,
	commands: browserCommands
})

export default defineConfig({
	server: {
		watch: {
			ignored: ['**/.*/**', '**/static/**', '**/dist/**']
		}
	},
	test: {
		projects: [
			defineProject({
				// A suite importing source needs the same substitution the published
				// build performs. There is no runtime default: a build that failed to
				// substitute must fail rather than ship a plausible wrong version.
				define: releaseDefines(),
				// Pure unit tests of the compile pipeline and plugin hooks
				test: {
					name: 'unit',
					include: [`${unitTestsPath}/**/*.test.ts`],
					exclude: configDefaults.exclude
				}
			}),
			defineProject({
				define: releaseDefines(),
				// Full CLI compile tests for all variations. Runs against built code
				test: {
					// Compiles brush 10s under full-suite load; an expired vitest timeout
					// doesn't cancel the compile, so generous ceilings keep every compile
					// inside its own test or hook.
					testTimeout: 60000,
					hookTimeout: 60000,
					name: 'compile',
					// Fails the run upfront when the Google Fonts CDN is unreachable —
					// the remote-asset tests deliberately fetch real external files.
					globalSetup: ['./test/utils/preflight-compile.ts'],
					include: [`${compileTestsPath}/**/*.test.ts`],
					exclude: configDefaults.exclude
				}
			}),
			defineProject({
				define: releaseDefines(),
				test: {
					// Next.js tests, runs against built code
					hookTimeout: 240000, // must exceed BUILD_TIMEOUT_MS so a contended build fails on its own bound, not the hook
					testTimeout: 60000,
					name: 'plugin-nextjs',
					globalSetup: ['./test/utils/preflight-plugin.ts'],
					fileParallelism: false,
					include: [`${nextjsTestsPath}/**/*.test.ts`]
				}
			}),
			defineProject({
				define: releaseDefines(),
				test: {
					// Unplugin tests, tests all bundlers, building node bundles. Runs against built code
					hookTimeout: 240000, // backstop only; runBuild bounds the actual build (must exceed BUILD_TIMEOUT_MS)
					testTimeout: 60000, // No single test should take longer than 1 min
					name: 'plugin-node',
					globalSetup: ['./test/utils/preflight-plugin.ts'],
					fileParallelism: false, // happy-dom triggers a node:vm CJS/ESM race under concurrency
					include: [`${unpluginTestsPath}/server/*.test.ts`]
				}
			}),
			defineProject({
				define: releaseDefines(),
				test: {
					// Unplugin tests, tests all bundlers, building browser bundles. Runs against built code
					hookTimeout: 240000, // backstop only; runBuild bounds the actual build (must exceed BUILD_TIMEOUT_MS)
					testTimeout: 60000, // No single test should take longer than 1 min
					name: 'plugin-browser',
					globalSetup: ['./test/utils/preflight-plugin.ts'],
					fileParallelism: false,
					include: [`${unpluginTestsPath}/browser/*.test.ts`],
					browser: createBrowserConfig('plugin-browser')
				}
			})
		]
	}
})
