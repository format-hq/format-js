import type { InstallResult } from './dependencies.ts'

import pc from 'picocolors'

import { confirm, log, spinner } from '@clack/prompts'

import { requirePrompt } from '../prompts.ts'
import { detectPackageManager, installCommand } from '../package-manager.ts'
import { installManifest, joinNames } from './dependencies.ts'
import { truncateForSpinner } from './run-install.ts'

export interface FinalizeDependenciesArgs {
	projectDir: string
	// Names written to package.json across the whole flow (Format packages plus
	// any styling/schema libraries). Drives the summary line and the prompt.
	addedDependencies: string[]
	// The --install / --no-install flag value, or undefined to prompt.
	install?: boolean
	skipPrompts: boolean
}

export interface FinalizeDependenciesResult {
	// Whether the user opted in to installing (also gates follow-up setup like
	// Panda codegen, which needs its dependency present).
	wantInstall: boolean
	installed: boolean
	result?: InstallResult
}

// The single place every scaffold flow ends: report what landed in
// package.json, decide whether to install (flag, --yes, or one prompt), and run
// the install when opted in. `init` and `new document` both funnel through here
// so the question is asked once, at the end, and reads the same everywhere. This
// lives apart from dependencies.ts so the pure manifest helpers stay free of the
// prompt library (Studio consumes those without pulling @clack).
export async function finalizeDependencies(args: FinalizeDependenciesArgs): Promise<FinalizeDependenciesResult> {
	const { projectDir, addedDependencies, install, skipPrompts } = args

	const hasAdded = addedDependencies.length > 0
	const verb = addedDependencies.length === 1 ? 'has' : 'have'
	const coloredNames = joinNames(addedDependencies.map(name => pc.cyan(name)))
	const addedLine = `${coloredNames} ${verb} been added to your package.json.`

	const wantInstall = await decideInstall({ install, skipPrompts, hasAdded, addedLine })

	if (!wantInstall || !hasAdded) {
		// Packages are in package.json but not on disk, so point at the one thing
		// left to do. This is the single home for the install instruction — the
		// closing message stays a clean sign-off.
		if (hasAdded && !wantInstall) {
			const packageManager = await detectPackageManager(projectDir)
			const { command, args } = installCommand(packageManager)
			log.warn(`Run ${pc.cyan(`${command} ${args.join(' ')}`)} when you're ready.`)
		}

		return { wantInstall, installed: false }
	}

	const installSpinner = spinner()
	installSpinner.start('Installing dependencies')

	const result = await installManifest({
		projectDir,
		onProgress: line => installSpinner.message(truncateForSpinner(line))
	})

	if (result.ok) {
		installSpinner.stop(`Dependencies installed with ${pc.cyan(result.packageManager)}`)
	}

	if (!result.ok) {
		installSpinner.error('Could not install dependencies')
	}

	return { wantInstall, installed: result.ok, result }
}

async function decideInstall(args: {
	install?: boolean
	skipPrompts: boolean
	hasAdded: boolean
	addedLine: string
}): Promise<boolean> {
	const { install, skipPrompts, hasAdded, addedLine } = args

	if (install !== undefined) {
		if (hasAdded) {
			log.info(addedLine)
		}

		return install
	}

	if (!hasAdded) {
		return true
	}

	if (skipPrompts) {
		log.info(addedLine)

		return true
	}

	return requirePrompt(
		await confirm({ message: `${addedLine} Automatically install dependencies?`, initialValue: true })
	)
}
