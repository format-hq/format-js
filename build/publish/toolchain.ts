/**
 * The Node and npm a release runs on, asserted rather than assumed.
 *
 *   node build/publish/toolchain.ts
 *
 * npm gained staged publishing in 11.15, and a Node release bundles exactly one
 * npm, so the pair below is chosen together: this Node ships that npm. The
 * staging job holds a publishing credential and must not install anything, so
 * it cannot upgrade npm itself — the toolchain it is handed has to be right
 * before it starts.
 *
 * The registry every npm command names is here too, for the same reason the
 * versions are: a release states what it is talking to rather than inheriting
 * it from whatever configuration the runner happens to carry.
 *
 * Both numbers are exact. A workflow that quietly ran on a different Node would
 * be publishing from a toolchain nobody reviewed, and the failure to find out
 * about that is worse than the failure to build.
 */

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { execute, type Run } from './exec.ts'

/**
 * The registry a release reads from and stages to.
 *
 * Passed on every npm command rather than left to configuration. An `.npmrc` in
 * the repository, the runner's home directory, or the environment can point
 * `npm` somewhere else, and a release must ask the registry it means to publish
 * to whether a version is free.
 */
export const NPM_REGISTRY = 'https://registry.npmjs.org/'

/** Node 24 LTS. Its bundled npm is the version below. */
export const NODE_VERSION = '24.19.0'

/** Bundled with the Node above, and at or past the staged-publishing floor. */
export const NPM_VERSION = '11.17.0'

/** The first npm with `npm stage publish`. */
export const NPM_STAGED_PUBLISH_FLOOR = '11.15.0'

export interface Toolchain {
	node: string
	npm: string
}

/** Every mismatch, so one run reports the whole toolchain rather than its first surprise. */
export function toolchainProblems({ node, npm }: Toolchain): string[] {
	const problems: string[] = []

	if (node !== NODE_VERSION) {
		problems.push(`Node is ${node}, and this release pins ${NODE_VERSION}`)
	}
	if (npm !== NPM_VERSION) {
		problems.push(
			`npm is ${npm}, and Node ${NODE_VERSION} bundles ${NPM_VERSION}` +
				` — staged publishing needs ${NPM_STAGED_PUBLISH_FLOOR} or newer, and this job cannot install one`
		)
	}

	return problems
}

/** Whether the left version is at or past the right one. */
export function atLeast(version: string, floor: string): boolean {
	const parts = (text: string) => text.split('.').map(Number)
	const [a, b] = [parts(version), parts(floor)]

	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] > b[i]
	}
	return true
}

export function readToolchain(cwd: string, run: Run = execute): Toolchain {
	const npm = run('npm', ['--version'], { cwd, timeoutMs: 60_000 })
	if (!npm.ok) throw new Error(`could not read the npm version:\n${npm.output}`)

	return { node: process.versions.node, npm: npm.output.trim() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const toolchain = readToolchain(process.cwd())
	const problems = toolchainProblems(toolchain)

	if (problems.length > 0) {
		console.error(`the release toolchain is wrong:\n  ${problems.join('\n  ')}`)
		process.exitCode = 1
	} else {
		console.log(`node ${toolchain.node}, npm ${toolchain.npm}`)
	}
}
