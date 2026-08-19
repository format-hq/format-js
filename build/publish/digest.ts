/**
 * The digest a release records for each tarball.
 *
 * Written in npm's own integrity form, `sha512-<base64>`, so the value in a
 * release manifest can be compared directly against what the registry reports
 * for a published version.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function digestBytes(bytes: Uint8Array): string {
	return `sha512-${createHash('sha512').update(bytes).digest('base64')}`
}

export function digestFile(path: string): string {
	return digestBytes(readFileSync(path))
}
