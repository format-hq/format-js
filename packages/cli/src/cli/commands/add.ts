import { spawn } from 'node:child_process'

import { CliError } from '../../errors.ts'
import { detectPackageManager, commandForPlatform } from '../../package-manager.ts'
import { loadProjectState } from '../../project.ts'
import { formatDependencyVersion } from '../../scaffold/project.ts'

import type { PackageManager } from '../../package-manager.ts'

// Format packages that go in dependencies; everything else Format ships is a
// devDependency (needed while authoring, not at runtime).
export const RUNTIME_PACKAGES = ['@format.dev/client', '@format.dev/zip']

// Accept full names or shorthands: `format add zip` means @format.dev/zip.
function normalisePackageName(name: string): string {
	if (name.startsWith('@format.dev/')) {
		return name
	}

	return `@format.dev/${name}`
}

function installArgs(packageManager: PackageManager, packages: string[], dev: boolean): string[] {
	const saveFlag = dev ? '-D' : ''

	switch (packageManager) {
		case 'npm':
			return ['install', ...(dev ? ['--save-dev'] : []), ...packages]
		default:
			return ['add', ...(saveFlag ? [saveFlag] : []), ...packages]
	}
}

// Install Format packages at the project's pinned version, in the right
// dependency section — so `format add zip` can never pull a version that
// drifts from the lockstep pin the way a plain `npm i @format.dev/zip` would.
export async function addCommand(cwd: string, packages: string[]): Promise<number> {
	if (packages.length === 0) {
		throw new CliError(
			'Usage: format add <package> [...] — e.g. `format add zip` or `format add "@format.dev/client"`.'
		)
	}

	const state = await loadProjectState(cwd)

	if (!state.packageJsonPath) {
		throw new CliError('No package.json found next to the config — nothing to install into.')
	}

	const pinnedVersion = state.pinnedVersion

	if (!pinnedVersion) {
		throw new CliError(
			`${state.configFile.filepath} is missing its required "version" field. Run \`format init\` to set the project up.`
		)
	}

	const names = packages.map(normalisePackageName)
	const runtime = names.filter(name => RUNTIME_PACKAGES.includes(name))
	const dev = names.filter(name => !RUNTIME_PACKAGES.includes(name))

	const packageManager = await detectPackageManager(state.projectDir)

	for (const [group, isDev] of [
		[runtime, false],
		[dev, true]
	] as const) {
		if (group.length === 0) {
			continue
		}

		const dependencyVersion = formatDependencyVersion(pinnedVersion)
		const pinned = group.map(name => `${name}@${dependencyVersion}`)

		console.log(
			`Installing ${pinned.join(', ')} ${isDev ? '(devDependencies)' : '(dependencies)'} with ${packageManager}...`
		)

		await runInstall(packageManager, installArgs(packageManager, pinned, isDev), state.projectDir)
	}

	console.log('')
	console.log(`Done. Added at ${formatDependencyVersion(pinnedVersion)}.`)

	return 0
}

async function runInstall(packageManager: PackageManager, args: string[], cwd: string): Promise<void> {
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
