import { version } from '../package.json'

// `process` is absent in workers/browsers; the platform suffix is best-effort.
const platformSuffix =
	typeof process !== 'undefined' && process.platform ? ` (${process.platform}) node ${process.version}` : ''

export const USER_AGENT = `@format.dev/zip/${version}${platformSuffix}`

export const MANIFEST_FILE_NAME = 'format.manifest.json'

/**
 * Fixed modification time stamped into every ZIP entry so archives are
 * reproducible. Without it, fflate writes `Date.now()` into each entry, so a
 * byte-identical asset set hashes differently on every build and can't be
 * deduplicated by content. Noon UTC on 1980-01-01 (the ZIP epoch) stays at or
 * above the format's 1980 minimum in every timezone. fflate encodes the DOS
 * time from local components, so output is reproducible within a timezone,
 * which is what content dedup from a given runtime needs.
 */
export const ZIP_EPOCH = Date.UTC(1980, 0, 1, 12)
