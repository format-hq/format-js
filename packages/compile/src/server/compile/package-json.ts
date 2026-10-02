import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUNDLE_ENTRY_POINT_FILE_NAME } from './constants'

type PackageJson = {
	name: string
	version?: string
	private?: boolean
	main: string
	type?: string
	module?: string
	exports?: Record<string, Record<string, string>>
}

export async function emitPackageJson(outDir: string, bundleName: string, format: string, version: string | null) {
	const entryPath = `./${BUNDLE_ENTRY_POINT_FILE_NAME}`

	const pkgJson: PackageJson = {
		name: bundleName,
		...(version ? { version } : { private: true }),
		main: entryPath
	}

	if (format === 'es') {
		pkgJson.type = 'module'
		pkgJson.module = entryPath
		pkgJson.exports = {
			'.': {
				import: entryPath,
				require: entryPath
			}
		}
	}

	if (format === 'cjs') {
		pkgJson.type = 'commonjs'
		pkgJson.exports = {
			'.': {
				require: entryPath,
				default: entryPath
			}
		}
	}

	const file = join(outDir, 'package.json')
	await writeFile(file, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8')
}
