import type { FormatConfig } from '../../shared/types'

import { readFileSync } from 'node:fs'
import semver from 'semver'
import { CompileError } from '../errors'
import { createUserRequire } from '../project/user-project-dir'

function getPackageJsonByName(name: string): any {
	try {
		const userRequire = createUserRequire()
		const pkgPath = userRequire.resolve(`${name}/package.json`)
		return JSON.parse(readFileSync(pkgPath, 'utf8'))
	} catch {
		throw new CompileError(`Could not resolve installed package "${name}"`)
	}
}

function getInstalledPackageVersion(name: string): string {
	const pkgJson = getPackageJsonByName(name)

	if (!pkgJson?.version) {
		throw new CompileError(`Installed package "${name}" has no version field`)
	}

	return pkgJson.version
}

interface DecodeStyleEntitiesArgs {
	framework: FormatConfig['framework']
	getReactDomVersion?: () => string
}

// React 18 and below, plus Vue 3, HTML-escape text nodes inside `<style>` during
// SSR, producing entities like `&quot;` that are invalid in the final CSS string.
// React 19 treats `<style>` as a raw-text element and leaves it untouched, and
// HTML templates are authored literally, so neither needs decoding.
//
// `getReactDomVersion` is injectable so the decision table can be tested without
// touching the filesystem; production uses the real installed-version lookup.
export function shouldDecodeStyleEntities(args: DecodeStyleEntitiesArgs): boolean {
	const { framework, getReactDomVersion } = args

	if (framework === 'vue') {
		return true
	}

	if (framework === 'html') {
		return false
	}

	const resolveVersion = getReactDomVersion ?? (() => getInstalledPackageVersion('react-dom'))

	try {
		return semver.major(resolveVersion()) < 19
	} catch {
		return false
	}
}
