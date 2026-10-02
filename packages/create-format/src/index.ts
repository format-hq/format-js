#!/usr/bin/env node

// create-format is a thin shell so `npm create format` works: it delegates
// straight to `format new project` in @format.dev/cli, which owns all scaffolding.
// It should rarely need republishing — evolution happens in the CLI.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = dirname(fileURLToPath(import.meta.url))

function resolveCliBin(): string {
	const require = createRequire(import.meta.url)
	const packageJsonPath = require.resolve('@format.dev/cli/package.json', { paths: [_dirname] })
	const packageJson = require(packageJsonPath) as { bin?: Record<string, string> }
	const binRelativePath = packageJson.bin?.format

	if (!binRelativePath) {
		throw new Error('The installed @format.dev/cli does not expose a "format" bin.')
	}

	return resolve(dirname(packageJsonPath), binRelativePath)
}

const child = spawn(process.execPath, [resolveCliBin(), 'new', 'project', ...process.argv.slice(2)], {
	stdio: 'inherit'
})

child.on('exit', code => {
	process.exitCode = code ?? 0
})
