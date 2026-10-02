#!/usr/bin/env node
// Committed launcher for the `format` bin. pnpm only creates a bin shim when
// the target file exists at install time, and a fresh checkout (CI) installs
// before dist/ is built — pointing `bin` straight at dist/index.mjs means no
// shim is ever created there. This file always exists, so the shim always
// links; it defers to the built CLI at run time.
const distEntry = new URL('../dist/index.mjs', import.meta.url)

try {
	await import(distEntry.href)
} catch (error) {
	const isMissingDist = error?.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('dist/index.mjs')

	if (!isMissingDist) {
		throw error
	}

	console.error('@format.dev/cli is not built (dist/ is missing). Run `pnpm build` from the repo root, then re-run.')
	process.exit(1)
}
