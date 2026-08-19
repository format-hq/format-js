import { spawn } from 'node:child_process'

import { commandForPlatform } from '../package-manager.ts'

export interface RunInstallArgs {
	command: string
	args: string[]
	cwd: string
	onProgress?: (line: string) => void
}

export interface RunInstallResult {
	ok: boolean
	code: number | null
	error?: Error
	output: string
}

const MAX_OUTPUT_LINES = 40

// A spinner shows one live line of install output. Clip it to the terminal width
// so a long line can't wrap and tear the prompt gutter apart.
export function truncateForSpinner(line: string): string {
	const available = Math.max(20, (process.stdout.columns ?? 80) - 10)

	if (line.length <= available) {
		return line
	}

	return `${line.slice(0, available - 1)}…`
}

// Package managers are noisy: peer-dependency warnings, deprecation notices, and
// a full dependency listing all land on stdout. Capturing rather than inheriting
// keeps that out of the prompt flow, while `onProgress` feeds the caller a single
// live line to show. The buffer is kept so a failure can still report what
// happened — trimmed to the tail, which is where the real error lands.
export async function runInstall(args: RunInstallArgs): Promise<RunInstallResult> {
	const { command, args: commandArgs, cwd, onProgress } = args

	return new Promise<RunInstallResult>(resolvePromise => {
		const child = spawn(commandForPlatform(command), commandArgs, {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: false
		})

		const lines: string[] = []

		const collect = (chunk: Buffer) => {
			const text = chunk.toString()

			text
				.split('\n')
				.map(line => line.trim())
				.filter(Boolean)
				.forEach(line => {
					lines.push(line)
					onProgress?.(line)
				})
		}

		child.stdout?.on('data', collect)
		child.stderr?.on('data', collect)

		const output = () => lines.slice(-MAX_OUTPUT_LINES).join('\n')

		child.on('error', error => {
			resolvePromise({ ok: false, code: null, error, output: output() })
		})

		child.on('exit', code => {
			resolvePromise({ ok: code === 0, code, output: output() })
		})
	})
}
