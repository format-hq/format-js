import { spawn } from 'node:child_process'

import { writeConfigVersion } from '../../config.ts'
import { rewriteFormatDependencies } from '../../versioning/deps.ts'
import { CliError } from '../../errors.ts'
import { detectPackageManager, installCommand } from '../../package-manager.ts'
import { loadProjectState } from '../../project.ts'
import { fetchLatestVersion } from '../../versioning/registry.ts'
import { isExactVersion } from '../../versioning/semver.ts'

// Applies the pinned version everywhere. With no argument the config's
// `version` field is the target (hand-editing it is a supported flow); an
// explicit version or `latest` updates the field first. Missing field:
// resolve latest, write it, then apply.
export async function updateCommand(cwd: string, target?: string): Promise<number> {
	const state = await loadProjectState(cwd)

	const targetVersion = await resolveTargetVersion({ target, pinnedVersion: state.pinnedVersion })

	if (targetVersion !== state.pinnedVersion) {
		await writeConfigVersion({ filepath: state.configFile.filepath, version: targetVersion })
		console.log(`Pinned Format ${targetVersion} in ${state.configFile.filepath}`)
	} else {
		console.log(`Applying pinned Format ${targetVersion}`)
	}

	if (!state.packageJsonPath) {
		console.log('No package.json found next to the config — nothing to install.')

		return 0
	}

	const rewritten = await rewriteFormatDependencies({
		packageJsonPath: state.packageJsonPath,
		version: targetVersion
	})

	if (rewritten.length === 0) {
		console.log('All installed Format packages already match.')

		return 0
	}

	for (const change of rewritten) {
		console.log(`  ${change.name}  ${change.from} → ${change.to}`)
	}

	const packageManager = await detectPackageManager(state.projectDir)
	const { command, args } = installCommand(packageManager)

	console.log('')
	console.log(`Installing with ${packageManager}...`)

	await runInstall({ command, args, cwd: state.projectDir })

	console.log('')
	console.log(`Done. Your project is on Format ${targetVersion}.`)

	return 0
}

interface ResolveTargetVersionArgs {
	target?: string
	pinnedVersion: string | null
}

async function resolveTargetVersion(args: ResolveTargetVersionArgs): Promise<string> {
	const { target, pinnedVersion } = args

	if (target === 'latest') {
		return fetchLatestVersion()
	}

	if (target) {
		if (!isExactVersion(target)) {
			throw new CliError(`"${target}" is not an exact version. Use a version like 0.1.2, or \`format update latest\`.`)
		}

		return target
	}

	if (pinnedVersion) {
		return pinnedVersion
	}

	// The version field is required; a config without one is invalid, not a
	// state to recover from. `format update latest` remains the explicit way
	// to write it.
	throw new CliError(
		'format.config.json is missing its required "version" field. Run `format update latest` to pin the newest release, or `format init` to set the project up.'
	)
}

interface RunInstallArgs {
	command: string
	args: string[]
	cwd: string
}

async function runInstall(args: RunInstallArgs): Promise<void> {
	const { command, args: commandArgs, cwd } = args

	await new Promise<void>((resolvePromise, rejectPromise) => {
		const child = spawn(command, commandArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })

		child.on('error', error => {
			rejectPromise(new CliError(`Failed to run ${command} install: ${error.message}`))
		})

		child.on('exit', code => {
			if (code === 0) {
				resolvePromise()

				return
			}

			rejectPromise(new CliError(`${command} install exited with code ${code}.`))
		})
	})
}
