import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI_PACKAGE_NAME = '@format.dev/cli'

// The version of the @format.dev/cli package this code was installed from.
// `format update` compares it with the target to decide whether to hand off,
// so it reads the installed manifest rather than the build-time jsVersion: the
// manifest is what npm actually fetched for a given version.
export async function readCliPackageVersion(): Promise<string> {
	let dir = dirname(fileURLToPath(import.meta.url))

	for (;;) {
		const candidate = join(dir, 'package.json')

		if (existsSync(candidate)) {
			const manifest = JSON.parse(await fs.readFile(candidate, 'utf8')) as { name?: string; version: string }

			if (manifest.name === CLI_PACKAGE_NAME) {
				return manifest.version
			}
		}

		const parent = dirname(dir)

		if (parent === dir) {
			throw new Error(`Could not find the ${CLI_PACKAGE_NAME} package.json above ${fileURLToPath(import.meta.url)}`)
		}

		dir = parent
	}
}
