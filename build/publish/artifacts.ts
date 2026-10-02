/**
 * Building the release surface and packing it, once.
 *
 * Everything downstream — the content rules, publint, attw, the release
 * manifest, staging — reads the tarballs this module produces. Packing once
 * and passing the paths along is what stops a release from checking one
 * artifact and uploading another.
 */

import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { digestFile } from './digest.ts'
import { execute, type Run } from './exec.ts'
import { tarballName } from './release-manifest.ts'
import type { PublishSurface } from './surface.ts'

export const STUDIO = '@format.dev/studio'

/**
 * Studio's plain `build` ends by packing the engine, a Rust step that produces
 * nothing inside studio's `files`. Its `build:release` skips that and sets
 * NODE_ENV=production, which turns off source maps — and studio publishes all
 * of `dist/**`, so a development build ships maps whose `sourcesContent`
 * embeds its own source verbatim. Studio is the one package here that
 * publishes compiled output and keeps its source closed.
 */
const RELEASE_BUILD_SCRIPTS: Record<string, string> = { [STUDIO]: 'build:release' }

export class ArtifactError extends Error {}

export interface Tarball {
	name: string
	version: string
	/** The file name npm gives the tarball, which is also what a release records. */
	file: string
	/** Absolute path to the packed bytes. */
	path: string
	/** npm's integrity form, `sha512-<base64>`. */
	sha512: string
}

export interface BuildOptions {
	surface: PublishSurface
	/** Workspace members to keep out of the build, by name; absent ones are ignored. */
	exclude?: string[]
	run?: Run
	log?: (message: string) => void
}

/**
 * Builds every published package together with the packages it builds against.
 *
 * One recursive run, ordered by pnpm, because these packages build against
 * each other's `dist` rather than their source: compile's prebundle reads the
 * CLI, studio's node build reads compile, and zip inlines utils. Building them
 * in the order the release contract lists would work only on a tree that was
 * already built.
 *
 * The `<name>...` selector takes a package with its dependencies, so the
 * closure covers workspace packages that never publish. Studio joins as
 * dependencies-only, `^...`, and builds afterwards under its release script.
 */
export function buildPackages({ surface, exclude = [], run = execute, log = () => {} }: BuildOptions): void {
	const { repoRoot, packages, members } = surface
	const present = new Set(members.map(member => member.name))

	const selectors = packages.flatMap(({ name }) =>
		name in RELEASE_BUILD_SCRIPTS ? ['--filter', `${name}^...`] : ['--filter', `${name}...`]
	)
	const exclusions = exclude.filter(name => present.has(name)).flatMap(name => ['--filter', `!${name}`])

	const closure = run('pnpm', [...selectors, ...exclusions, 'build'], { cwd: repoRoot })
	if (!closure.ok) throw new ArtifactError(`building the release closure failed:\n${closure.output.slice(-4000)}`)
	log('the dependency closure: built')

	for (const { name, dir } of packages) {
		const script = RELEASE_BUILD_SCRIPTS[name]
		if (!script) continue

		// A mirror carries studio already built, with no script left to run.
		const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
			scripts?: Record<string, string>
		}
		if (!manifest.scripts?.[script]) {
			log(`${name}: no ${script} script, packing as it stands`)
			continue
		}

		const built = run('pnpm', ['--filter', name, script], { cwd: repoRoot })
		if (!built.ok) throw new ArtifactError(`${name} ${script} failed:\n${built.output.slice(-4000)}`)
		log(`${name}: built with ${script}`)
	}
}

export interface PackOptions {
	surface: PublishSurface
	/** Where the tarballs land. Created if absent, and must hold nothing else. */
	destination: string
	run?: Run
	log?: (message: string) => void
}

/**
 * Packs every published package into one directory, then checks that directory
 * holds exactly the expected files.
 *
 * The set comparison catches a package that packed under a name nobody
 * expected and a stray tarball left behind by something else, either of which
 * would otherwise reach the release manifest as a plausible-looking entry.
 */
export function packPackages({ surface, destination, run = execute, log = () => {} }: PackOptions): Tarball[] {
	const { repoRoot, contract, packages } = surface
	mkdirSync(destination, { recursive: true })

	const expected = new Map(packages.map(pkg => [tarballName(pkg.name, contract.jsVersion), pkg]))

	for (const { name } of packages) {
		const packed = run('pnpm', ['--filter', name, 'pack', '--pack-destination', destination], { cwd: repoRoot })
		if (!packed.ok) throw new ArtifactError(`packing ${name} failed:\n${packed.output.slice(-2000)}`)
	}

	const produced = readdirSync(destination).filter(entry => entry.endsWith('.tgz'))

	const missing = [...expected.keys()].filter(file => !produced.includes(file))
	if (missing.length > 0) {
		throw new ArtifactError(
			`packing produced no ${missing.join(', ')} in ${destination}\n` +
				`it holds: ${produced.join(', ') || 'nothing'}\n` +
				'a package packed under a name its manifest does not describe'
		)
	}

	const extra = produced.filter(file => !expected.has(file))
	if (extra.length > 0) {
		throw new ArtifactError(
			`${destination} holds tarballs this release did not pack: ${extra.join(', ')}\n` +
				'a release stages the files it packed and nothing beside them'
		)
	}

	const tarballs = packages.map(({ name }) => {
		const file = tarballName(name, contract.jsVersion)
		const path = join(destination, file)
		return { name, version: contract.jsVersion, file, path, sha512: digestFile(path) }
	})

	log(`${tarballs.length} tarballs in ${destination}`)
	return tarballs
}
