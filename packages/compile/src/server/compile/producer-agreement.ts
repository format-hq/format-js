/**
 * Check that every installed Format package that produces documents is on the
 * same release as this compiler.
 *
 * The compiler stamps `data-sdk` with its own version, but React or Vue rendered
 * the markup. If they are on a different version that stamp is wrong, so this
 * refuses before anything renders and names the packages to fix.
 *
 * It finds each package by walking up `node_modules` and reading the first
 * `package.json` it hits, which is the copy Node would load. It does not use
 * `require.resolve`: under vitest that resolves to this workspace's own source,
 * so a test for "not installed" would pass by finding the repo it runs in.
 *
 * A package that is not installed is fine — a React project has no Vue, and a
 * build that aliases an SDK to source has no manifest to read. A `package.json`
 * that exists but will not parse is not fine: the walk stops there rather than
 * carrying on up and reporting some other installation's version as this one's.
 *
 * `finalize-document-html` checks again at render time, comparing the `data-sdk`
 * already on the markup against this compiler's. That catches what this cannot
 * see, such as Yarn PnP, where there is no `node_modules` tree to walk.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { sdkVersion } from './producer-release'

/**
 * The packages that produce document markup this compiler then stamps.
 *
 * Only these. `@format.dev/zip`, `@format.dev/fonts` and the rest move on the
 * same release number and are checked by the lockstep warning, but none of them
 * writes markup, so none of them can make a document's provenance wrong.
 */
export const PRODUCING_PACKAGES = ['@format.dev/react', '@format.dev/vue'] as const

/** One producing package, as it resolves from the project being compiled. */
export interface ResolvedProducer {
	name: string
	version: string
}

/**
 * A producing package is installed and its version cannot be established.
 *
 * Separate from disagreement because it is a different fact: nothing has been
 * shown to disagree, and nothing has been shown to agree either. The reason it
 * stops the compile anyway is that this module exists to make one claim
 * honest — that the release number about to be stamped on a document is the
 * release that produced it — and a package whose version is unreadable is
 * exactly the case where that claim cannot be made.
 *
 * Only a package that is absent is silence. Absent is an ordinary state with an
 * ordinary meaning: a project that uses React never installed Vue, or a build
 * aliased an SDK to source. A manifest that exists and will not parse is neither
 * of those, and reading past it to a copy in a parent directory would be worse
 * than failing — it would report a version belonging to an installation that is
 * not the one Node will load.
 */
export class ProducerManifestError extends Error {
	readonly name = 'ProducerManifestError'

	constructor(packageName: string, manifest: string, problem: string) {
		super(
			`Format cannot read which version of ${packageName} is installed:\n\n  ${manifest}\n  ${problem}\n\n` +
				'That package produces document markup and Format stamps the release that produced it onto every ' +
				'document, so a version it cannot establish is one it cannot honestly write down. Nothing was ' +
				'compiled. Reinstall your dependencies — `format update` brings every @format.dev/* package to one ' +
				'version.'
		)
	}
}

export class ProducerAgreementError extends Error {
	readonly compilerSdk: string
	readonly disagreeing: ResolvedProducer[]

	constructor(compilerSdk: string, disagreeing: ResolvedProducer[]) {
		const listed = disagreeing.map(producer => `  ${producer.name}  ${producer.version}`).join('\n')

		super(
			`Format ${compilerSdk} is compiling, and these packages are a different release:\n\n${listed}\n\n` +
				'A document would be stamped as one release having produced work from two, so nothing was ' +
				'compiled. Bring every @format.dev/* package to one version — `format update` does it.'
		)

		this.name = 'ProducerAgreementError'
		this.compilerSdk = compilerSdk
		this.disagreeing = disagreeing
	}
}

/**
 * The producing packages that resolve from `cwd`, with the versions that will
 * actually run.
 *
 * Exported so a test can see what resolution found without inferring it from
 * whether a throw happened.
 */
export function resolveProducers(cwd: string, packages: readonly string[] = PRODUCING_PACKAGES): ResolvedProducer[] {
	const found: ResolvedProducer[] = []

	for (const name of packages) {
		const version = installedVersion(cwd, name)

		if (version !== null) {
			found.push({ name, version })
		}
	}

	return found
}

/**
 * The version of `name` this project would load, or null when it is not
 * installed anywhere above `cwd`.
 *
 * Null means one thing only: no `node_modules/<name>/package.json` exists on the
 * way up. That is the ordinary "this project does not use Vue" answer, and the
 * aliased-to-source answer, and neither is a fault.
 *
 * Everything else raises. Once a manifest exists at a level, the walk stops
 * there whatever the file turns out to be — because that is the copy Node will
 * load, and continuing upward would answer with a version belonging to a
 * different installation. A file that cannot be read, cannot be parsed, or names
 * no usable version is therefore a refusal rather than a shrug: this compiler is
 * about to stamp a release number onto a document on the strength of it.
 */
function installedVersion(cwd: string, name: string): string | null {
	let directory = resolve(cwd)

	for (;;) {
		const manifest = join(directory, 'node_modules', ...name.split('/'), 'package.json')

		let text: string
		try {
			text = readFileSync(manifest, 'utf8')
		} catch (error) {
			// Absent here, so look higher. Anything else — a directory in the way, a
			// file the process may not read — is a broken installation of a package
			// that is present, and reading past it would attribute a parent's version
			// to it.
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw new ProducerManifestError(name, manifest, (error as Error).message)
			}

			const parent = dirname(directory)
			// `dirname` of the root is the root, which is how the walk ends.
			if (parent === directory) return null

			directory = parent
			continue
		}

		let version: unknown
		try {
			version = (JSON.parse(text) as { version?: unknown }).version
		} catch (error) {
			throw new ProducerManifestError(
				name,
				manifest,
				`its package.json is not valid JSON (${(error as Error).message})`
			)
		}

		if (typeof version !== 'string' || version.trim() === '') {
			throw new ProducerManifestError(
				name,
				manifest,
				`its package.json declares version ${JSON.stringify(version)}, which names no release`
			)
		}

		return version
	}
}

/**
 * Refuse to compile when a producing package is a different release from this
 * compiler.
 *
 * Called once per compile run, before any document is rendered, so the failure
 * arrives as one message about the installation rather than as a stamping error
 * per document.
 */
export function assertProducersAgree(cwd: string, compilerSdk: string = sdkVersion): void {
	const disagreeing = resolveProducers(cwd).filter(producer => producer.version !== compilerSdk)

	if (disagreeing.length > 0) {
		throw new ProducerAgreementError(compilerSdk, disagreeing)
	}
}
