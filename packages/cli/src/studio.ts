import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { CliError } from './errors.ts'
import { loadProjectState } from './project.ts'
import { startUpdateCheck } from './versioning/update-check.ts'

export const STUDIO_PACKAGE = '@format.dev/studio'
export const COMPILE_PACKAGE = '@format.dev/compile'

const STUDIO_BIN_NAME = 'format-studio'
const COMPILE_BIN_NAME = 'format-compile'

// Which package answers a given subcommand. `compile` runs from the UI-free
// @format.dev/compile package; everything else still spawns Studio.
interface TargetPackage {
	packageName: string
	binName: string
}

function targetForCommand(commandName: string | undefined): TargetPackage {
	if (commandName === 'compile') {
		return { packageName: COMPILE_PACKAGE, binName: COMPILE_BIN_NAME }
	}

	return { packageName: STUDIO_PACKAGE, binName: STUDIO_BIN_NAME }
}

interface LocalStudio {
	binPath: string
	version: string
}

// A project can install Studio deliberately (offline work, corporate
// registries); when it has, that copy is used instead of fetching. The walk
// is explicit rather than require.resolve: Node's resolver also consults
// NODE_PATH and global folders, which must never satisfy a project-local check.
function findStudioPackageJson(projectDir: string, packageName: string): string | null {
	let dir = resolve(projectDir)

	for (;;) {
		const candidate = join(dir, 'node_modules', packageName, 'package.json')

		if (existsSync(candidate)) {
			return candidate
		}

		const parent = dirname(dir)

		if (parent === dir) {
			return null
		}

		dir = parent
	}
}

async function findLocalStudio(projectDir: string, target: TargetPackage): Promise<LocalStudio | null> {
	const packageJsonPath = findStudioPackageJson(projectDir, target.packageName)

	if (!packageJsonPath) {
		return null
	}

	const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as {
		version: string
		bin?: Record<string, string>
	}

	const binRelativePath = packageJson.bin?.[target.binName]

	if (!binRelativePath) {
		throw new CliError(
			`The installed ${target.packageName} (${packageJson.version}) does not expose a "${target.binName}" bin. Run \`format update\` to align your packages.`
		)
	}

	return {
		binPath: resolve(dirname(packageJsonPath), binRelativePath),
		version: packageJson.version
	}
}

// Run a Studio subcommand (dev, compile, ...) at the project's pinned
// version: a locally installed Studio wins; otherwise npm exec fetches the
// exact pinned version into its cache and runs it from there.
export async function runStudioCommand(cwd: string, argv: string[]): Promise<number> {
	const state = await loadProjectState(cwd)

	// `dev` is a long-running session, so we check for a newer release in the
	// background and report it once the session ends (see startUpdateCheck).
	const isDevSession = argv[0] === 'dev'
	const updateCheck = isDevSession && state.pinnedVersion ? startUpdateCheck(state.pinnedVersion) : null

	const exitCode = await spawnStudioForProject(state, argv)

	if (updateCheck) {
		await updateCheck.report()
	}

	return exitCode
}

async function spawnStudioForProject(
	state: Awaited<ReturnType<typeof loadProjectState>>,
	argv: string[]
): Promise<number> {
	const target = targetForCommand(argv[0])
	const localStudio = await findLocalStudio(state.projectDir, target)
	const keepAliveOnSignal = argv[0] === 'dev'

	if (localStudio) {
		const isRealVersionMismatch = state.pinnedVersion !== null && localStudio.version !== state.pinnedVersion

		if (isRealVersionMismatch) {
			throw new CliError(
				`Installed ${target.packageName} is ${localStudio.version} but format.config.json pins ${state.pinnedVersion}. Run \`format update\` to bring them in line.`
			)
		}

		return spawnStudio(process.execPath, [localStudio.binPath, ...argv], state.projectDir, keepAliveOnSignal)
	}

	if (!state.pinnedVersion) {
		throw new CliError(
			`No "version" field in ${state.configFile.filepath} and no local ${target.packageName} install. Run \`format update\` to pin the latest Format release.`
		)
	}

	const packageSpec = `${target.packageName}@${state.pinnedVersion}`

	return spawnStudio(
		'npm',
		['exec', '-y', '--prefer-offline', '--', packageSpec, ...argv],
		state.projectDir,
		keepAliveOnSignal
	)
}

// When keepAliveOnSignal is set (the dev session), the parent ignores Ctrl+C so
// it survives to report the update nudge after Studio shuts down: the child is
// in the same process group and gets the SIGINT too, so it still exits. A
// second Ctrl+C force-quits, in case the child ever ignores the signal.
async function spawnStudio(command: string, args: string[], cwd: string, keepAliveOnSignal = false): Promise<number> {
	return new Promise<number>((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })

		let interrupts = 0
		const onSignal = () => {
			interrupts += 1

			if (interrupts >= 2) {
				process.exit(130)
			}
		}

		if (keepAliveOnSignal) {
			process.on('SIGINT', onSignal)
		}

		const cleanup = () => {
			if (keepAliveOnSignal) {
				process.off('SIGINT', onSignal)
			}
		}

		child.on('error', error => {
			cleanup()
			rejectPromise(new CliError(`Failed to launch Studio: ${error.message}`))
		})

		child.on('exit', (code, signal) => {
			cleanup()

			if (signal) {
				resolvePromise(1)

				return
			}

			resolvePromise(code ?? 0)
		})
	})
}
