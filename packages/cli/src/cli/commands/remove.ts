import { spawn } from 'node:child_process'

import { CliError } from '../../errors.ts'
import { detectPackageManager, commandForPlatform } from '../../package-manager.ts'
import { loadProjectState } from '../../project.ts'

import type { PackageManager } from '../../package-manager.ts'

// Accept full names or shorthands: `format remove zip` means @format.dev/zip.
function normalisePackageName(name: string): string {
	if (name.startsWith('@format.dev/')) {
		return name
	}

	return `@format.dev/${name}`
}

function removeArgs(packageManager: PackageManager, packages: string[]): string[] {
	if (packageManager === 'npm') {
		return ['uninstall', ...packages]
	}

	return ['remove', ...packages]
}

// The npm-side counterpart to `format add`. Removal has no version hazard —
// this exists so managing Format packages stays one mental model.
export async function removeCommand(cwd: string, packages: string[]): Promise<number> {
	if (packages.length === 0) {
		throw new CliError('Usage: format remove <package> [...] — e.g. `format remove zip`.')
	}

	const state = await loadProjectState(cwd)

	if (!state.packageJsonPath) {
		throw new CliError('No package.json found next to the config — nothing to remove from.')
	}

	const names = packages.map(normalisePackageName)

	if (names.includes('@format.dev/cli')) {
		throw new CliError(
			'Refusing to remove @format.dev/cli through itself. Use your package manager directly: `npm uninstall "@format.dev/cli"`.'
		)
	}

	const installedNames = state.dependencies.map(dependency => dependency.name)
	const notInstalled = names.filter(name => !installedNames.includes(name))

	if (notInstalled.length > 0) {
		throw new CliError(`Not installed in this project: ${notInstalled.join(', ')}.`)
	}

	const packageManager = await detectPackageManager(state.projectDir)

	console.log(`Removing ${names.join(', ')} with ${packageManager}...`)

	await runRemove(packageManager, removeArgs(packageManager, names), state.projectDir)

	console.log('')
	console.log('Done.')

	return 0
}

async function runRemove(packageManager: PackageManager, args: string[], cwd: string): Promise<void> {
	await new Promise<void>((resolvePromise, rejectPromise) => {
		const child = spawn(commandForPlatform(packageManager), args, { cwd, stdio: 'inherit', shell: false })

		child.on('error', error => {
			rejectPromise(new CliError(`Failed to run ${packageManager}: ${error.message}`))
		})

		child.on('exit', code => {
			if (code === 0) {
				resolvePromise()

				return
			}

			rejectPromise(new CliError(`${packageManager} exited with code ${code}.`))
		})
	})
}
