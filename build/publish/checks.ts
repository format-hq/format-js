/**
 * What a tarball must not carry, and what it must get right.
 *
 * These run over packed bytes rather than the working tree. A published
 * package resolves through its `exports` map, carries only the files its
 * `files` field selected, and depends on versions rather than links, so a
 * broken export path or an omitted file fails for the first customer and for
 * nobody before them.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { Tarball } from './artifacts.ts'
import { execute, resolveBin, type Failures, type Run } from './exec.ts'
import { STUDIO } from './artifacts.ts'
import type { PackageManifest, WorkspaceMember } from './surface.ts'

export interface Rule {
	pattern: RegExp
	reason: string
}

/**
 * Content a package must never publish, by package.
 *
 * Studio's build mode is one way its source could escape; these rules describe
 * the artifact instead, so a package that starts shipping source under this
 * name fails here rather than on npm, where a published version is permanent.
 *
 * Names and bytes both, because they catch different mistakes. A separate
 * `.map` file has a name to match, but an inline source map writes the same
 * `sourcesContent` into a data URL inside the JavaScript and produces no `.map`
 * entry at all, which no rule reading the file list alone would see.
 */
export const FORBIDDEN_CONTENTS: Record<string, { paths: Rule[]; text: Rule[] }> = {
	[STUDIO]: {
		paths: [
			{ pattern: /\.map$/, reason: 'source maps embed studio’s source in sourcesContent' },
			{ pattern: /(^|\/)(src|scripts|test)\//, reason: 'studio publishes compiled output only' }
		],
		text: [
			{
				pattern: /sourceMappingURL=data:/,
				reason: 'an inline source map carries studio’s source as a data URL'
			}
		]
	}
}

/**
 * Which resolution modes a tarball answers for, decided by what it advertises.
 *
 * A package whose `exports` carry a `require` condition is promising CommonJS
 * consumers something, and `node16` is what holds it to that promise. The rest
 * publish ESM alone, where the `node16-cjs` and node10 results describe a
 * consumer the package never claimed to serve — reporting those would gate
 * every release on a shape nothing here is built to have.
 */
export function attwProfile(manifest: PackageManifest): 'node16' | 'esm-only' {
	const advertisesRequire = (node: unknown): boolean =>
		typeof node === 'object' &&
		node !== null &&
		('require' in node || Object.values(node).some(value => advertisesRequire(value)))

	return advertisesRequire(manifest.exports) ? 'node16' : 'esm-only'
}

export interface CheckOptions {
	tarballs: Tarball[]
	packages: WorkspaceMember[]
	/** The tree whose install holds publint and attw. */
	toolRoot: string
	failures: Failures
	run?: Run
	log?: (message: string) => void
}

/**
 * Reads each tarball's file list and its bytes against the rules for that
 * package.
 *
 * This runs before anything is linted, because a tarball carrying private
 * source is a disclosure rather than a packaging defect, and npm keeps
 * published versions forever.
 */
export function checkTarballContents({ tarballs, toolRoot, failures, run = execute, log = () => {} }: CheckOptions) {
	const checked: string[] = []

	for (const { name, path } of tarballs) {
		const rules = FORBIDDEN_CONTENTS[name]
		if (!rules) continue
		checked.push(name)

		const listed = run('tar', ['-tzf', path], { cwd: toolRoot })
		if (!listed.ok) {
			failures.add('contents', name, listed.output)
			continue
		}

		const entries = listed.output.split('\n').map(line => line.replace(/^package\//, '').trim())
		for (const { pattern, reason } of rules.paths) {
			const offenders = entries.filter(entry => entry && pattern.test(entry))
			if (offenders.length > 0) {
				failures.add(
					'contents',
					name,
					`${offenders.length} file(s) matching ${pattern} — ${reason}\n  ${offenders.slice(0, 8).join('\n  ')}`
				)
			}
		}

		// -O streams every member's bytes rather than its name, so this reads what
		// the files say. Binary members are searched as bytes and simply do not
		// match.
		const bytes = run('tar', ['-xzOf', path], { cwd: toolRoot })
		if (!bytes.ok) {
			failures.add('contents', name, bytes.output)
			continue
		}

		for (const { pattern, reason } of rules.text) {
			if (pattern.test(bytes.output)) {
				failures.add('contents', name, `a packed file matches ${pattern} — ${reason}`)
			}
		}
	}

	if (checked.length > 0 && !failures.any) {
		log(`${checked.join(', ')}: no source-map files, no inline maps, no source paths`)
	}
}

/**
 * Runs publint and attw over the packed tarballs.
 *
 * Both tools come from the install under `toolRoot`, by path rather than
 * through `npx`, so a missing tool fails the run instead of starting a
 * download in the middle of a release.
 */
export function lintTarballs({
	tarballs,
	packages,
	toolRoot,
	failures,
	run = execute,
	log = () => {}
}: CheckOptions): Map<string, string> {
	const publint = resolveBin(toolRoot, 'publint')
	const attw = resolveBin(toolRoot, 'attw')
	const byName = new Map(packages.map(pkg => [pkg.name, pkg]))
	const profiles = new Map<string, string>()

	for (const { name, path } of tarballs) {
		const pkg = byName.get(name)
		if (!pkg) {
			failures.add('lint', name, 'the tarball has no package in this release to read its manifest from')
			continue
		}

		const linted = run(publint, ['run', '--strict', path], { cwd: toolRoot })
		if (!linted.ok) failures.add('publint', name, linted.output)

		const profile = attwProfile(pkg.manifest)
		profiles.set(name, profile)

		// A package may carry its own attw config to exclude entrypoints the tool
		// cannot model — a CSS export resolves to neither types nor JavaScript.
		const configPath = join(pkg.dir, '.attw.json')
		const args = ['--profile', profile]
		if (existsSync(configPath)) args.push('--config-path', configPath)

		const typed = run(attw, [...args, path], { cwd: toolRoot })
		if (!typed.ok) failures.add('attw', `${name} (--profile ${profile})`, typed.output)
	}

	if (!failures.any) {
		const dual = [...profiles].filter(([, profile]) => profile === 'node16').map(([name]) => name)
		log('publint --strict: clean')
		log(`attw: clean — node16 for ${dual.join(', ') || 'nothing'}, esm-only for the rest`)
	}

	return profiles
}
