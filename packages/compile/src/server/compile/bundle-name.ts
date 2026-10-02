import { DEFAULT_BUNDLE_NAME } from './constants'

const BUNDLE_NAME_RE = /^[a-z0-9][a-z0-9._-]*$/

export function resolveBundleName(bundleName?: string): string {
	if (bundleName == null) {
		return DEFAULT_BUNDLE_NAME
	}

	if (!BUNDLE_NAME_RE.test(bundleName)) {
		throw new Error(
			`Invalid bundleName "${bundleName}". Use lowercase letters or digits plus ".", "-", "_" (cannot start with ".", "-", "_" and "@" is not allowed).`
		)
	}

	return bundleName
}
