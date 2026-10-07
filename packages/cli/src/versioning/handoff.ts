import { spawn } from 'node:child_process'

import { CliError } from '../errors.ts'

// Set on the target CLI's process only, to the version the project is moving
// from. Its presence also stops that CLI from handing off again.
export const HANDOFF_ENV = 'FMT_UPDATE_HANDOFF'

const CLI_PACKAGE_NAME = '@format.dev/cli'

export function readHandoffFromVersion(): string | null {
	return process.env[HANDOFF_ENV] ?? null
}

// The environment for anything the target CLI starts, such as the install, so
// the marker never reaches dependency install scripts.
export function environmentWithoutHandoff(): NodeJS.ProcessEnv {
	const { [HANDOFF_ENV]: _handoff, ...environment } = process.env

	return environment
}

interface HandOffUpdateArgs {
	targetVersion: string
	fromVersion: string | null
	cwd: string
}

// Run `format update <target>` with the target release's own CLI, fetched the
// same way Studio is (npm exec works under every package manager). The release
// being moved to always runs its own upgrade, so a fix to the update logic
// helps the very upgrade that ships it.
//
// This is the contract every older CLI relies on to reach newer ones: keep the
// command, the argument, and HANDOFF_ENV stable.
export async function handOffUpdate(args: HandOffUpdateArgs): Promise<number> {
	const { targetVersion, fromVersion, cwd } = args

	const commandArgs = [
		'exec',
		'--yes',
		`--package=${CLI_PACKAGE_NAME}@${targetVersion}`,
		'--',
		'format',
		'update',
		targetVersion
	]

	return new Promise<number>((resolvePromise, rejectPromise) => {
		const child = spawn('npm', commandArgs, {
			cwd,
			stdio: 'inherit',
			shell: process.platform === 'win32',
			env: { ...process.env, [HANDOFF_ENV]: fromVersion ?? 'none' }
		})

		child.on('error', error => {
			rejectPromise(new CliError(`Failed to run the Format ${targetVersion} CLI: ${error.message}`))
		})

		child.on('exit', code => {
			resolvePromise(code ?? 1)
		})
	})
}
