/**
 * Running other programs, and finding the ones a tree installed.
 *
 * Every module here that shells out takes a `Run` rather than calling
 * `execFileSync` itself, so a test drives the same code with a recorded
 * command table and never needs a registry, a build, or a network.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface Result {
	ok: boolean
	/** stdout and stderr together, which is how a failing tool reports. */
	output: string
}

export type Run = (command: string, args: string[], options: { cwd: string; timeoutMs?: number }) => Result

/** The default `Run`: a synchronous child process whose output is captured. */
export const execute: Run = (command, args, { cwd, timeoutMs }) => {
	try {
		const output = execFileSync(command, args, {
			cwd,
			encoding: 'utf8',
			stdio: 'pipe',
			timeout: timeoutMs,
			maxBuffer: 256 * 1024 * 1024
		})
		return { ok: true, output }
	} catch (error) {
		const failure = error as { stdout?: string; stderr?: string; message?: string }
		return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` || (failure.message ?? 'no output') }
	}
}

export class MissingToolError extends Error {}

/**
 * The path of a command a tree installed, by name.
 *
 * Called instead of `npx`, which downloads a missing package rather than
 * failing. A release checks its artifacts with the versions the lockfile
 * pinned and reviewers approved, so a tool absent from `node_modules` is a
 * broken install to report rather than a download to start.
 */
export function resolveBin(toolRoot: string, name: string): string {
	const path = join(toolRoot, 'node_modules', '.bin', name)
	if (!existsSync(path)) {
		throw new MissingToolError(
			`${name} is not installed under ${toolRoot} — run the install before packing or checking`
		)
	}
	return path
}

/** One reported problem: which stage found it, in what, and what it said. */
export interface Failure {
	stage: string
	subject: string
	detail: string
}

/** Collects failures so a run reports every problem it found, not just the first. */
export class Failures {
	readonly all: Failure[] = []

	add(stage: string, subject: string, detail: string): void {
		this.all.push({ stage, subject, detail })
	}

	get any(): boolean {
		return this.all.length > 0
	}

	format(): string {
		return this.all.map(({ stage, subject, detail }) => `── ${stage}: ${subject}\n${detail.trim()}`).join('\n\n')
	}
}
