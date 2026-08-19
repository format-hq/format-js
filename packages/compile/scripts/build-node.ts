import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build, type UserConfig } from 'tsdown'
import Raw from 'unplugin-raw/rolldown'

// .ts extension: build/release typechecks under NodeNext, which requires one
import { releaseDefines } from '../../../build/release/constants.ts'
import { logger } from '../src/server/utils'

const _dirname = dirname(fileURLToPath(import.meta.url))
const env = process.env.NODE_ENV || 'development'
const isProd = env === 'production'

// In watch mode the dist is rebuilt in place on every change. Cleaning it first
// would briefly delete every module, and any consumer importing compile's dist
// mid-rebuild (the Studio dev server, its build watchers) would hit a missing
// file. A one-shot build still cleans so stale output never lingers.
const isWatch = process.env.FMT_WATCH === 'true'

// Unbundled on purpose: Studio (and later the bundler plugins) deep-import
// individual modules via the `./internal/*` and `./shared/*` package exports,
// so dist must mirror src one file per module. Module-level singletons
// (runtime-state, environment) also stay single this way.
const config: UserConfig = {
	entry: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/generated/**'],
	unbundle: true,
	// `create-renderer.ts` imports `virtual:*` modules the compile pipeline only
	// supplies when it builds a user document. Building compile's own dist has no
	// such resolver, so mark them external explicitly to skip the (expected)
	// unresolved-import warnings. The runtime copy is the prebundled generated one.
	external: [/^virtual:/],
	dts: { sourcemap: !isProd },
	sourcemap: !isProd,
	minify: false,
	outDir: 'dist',
	clean: !isWatch,
	format: 'esm',
	platform: 'node',
	tsconfig: resolve(_dirname, '../tsconfig.json'),
	plugins: [Raw()],
	target: 'es2020',
	define: {
		'process.env.NODE_ENV': JSON.stringify(env),
		// Supplies the engine target stamped into every document compile produces.
		...releaseDefines()
	},
	outputOptions: {
		sourcemap: !isProd
	}
}

async function main() {
	await build(config)
}

main().catch(error => {
	// Avoid `process.exit(1)` so a parent runner doesn't occasionally truncate piped stderr output.
	logger.error('Compile node build failed.', error)
	process.exitCode = 1
})
