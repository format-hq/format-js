/**
 * The release numbers a build substitutes into its output.
 *
 * One is `FORMAT_JS_VERSION`, the version the packages publish at; the CLI
 * bakes it so a scaffolded project pins the set that was tested together. The
 * other is `FORMAT_ENGINE_TARGET`, the released engine those packages target;
 * React, Vue, Compile, and Studio bake it, documents carry it as `data-engine`,
 * and Studio resolves its engine download from it.
 *
 * They stay two constants. A single one would weld the publish version to the
 * engine version, and the coupling would go unnoticed for as long as the two
 * numbers happened to match.
 */

import { join } from 'node:path'

import { REPO_ROOT, readReleaseManifest } from './manifest.ts'

/**
 * Both release numbers, validated by the same reader the release tooling uses,
 * so a manifest a build accepts is a manifest the contract test accepts.
 *
 * Setting `FORMAT_RELEASE_MANIFEST_PATH` names a different contract file,
 * honoured only under a test runner. Outside one this throws rather than
 * ignoring it: a build takes its numbers from the workspace root and nowhere else,
 * and a stray value in a release environment would otherwise stamp artifacts
 * with a version nobody approved.
 */
export function readReleaseConstants(repoRoot: string = REPO_ROOT): { jsVersion: string; engineTarget: string } {
	const overridePath = process.env.VITEST ? process.env.FORMAT_RELEASE_MANIFEST_PATH : undefined

	if (process.env.FORMAT_RELEASE_MANIFEST_PATH && !process.env.VITEST) {
		throw new Error(
			'FORMAT_RELEASE_MANIFEST_PATH is set outside a test run. A build takes its release numbers ' +
				'from format-release.json at the workspace root, never from an environment override.'
		)
	}

	const { jsVersion, engineTarget } = readReleaseManifest(overridePath ?? join(repoRoot, 'format-release.json'))

	return { jsVersion, engineTarget }
}

export function releaseDefines(repoRoot = REPO_ROOT) {
	const { jsVersion, engineTarget } = readReleaseConstants(repoRoot)

	return {
		FORMAT_JS_VERSION: JSON.stringify(jsVersion),
		FORMAT_ENGINE_TARGET: JSON.stringify(engineTarget)
	}
}
