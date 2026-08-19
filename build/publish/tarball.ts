/**
 * Reading a package's own manifest out of the tarball that would be published.
 *
 * The staging job is handed tarballs and a record describing them. Comparing
 * the two proves the bytes arrived unaltered and nothing more — the record was
 * written by a job that ran an install and a build, so it is not an independent
 * authority on what those bytes contain. Opening each tarball and reading the
 * `package.json` inside it answers a different question: what this file will
 * actually publish as.
 *
 * That answer has to be the same one npm would reach, so the whole archive is
 * read rather than stopped at the first match. A tar file can name one path
 * more than once — plainly, through a pax or GNU extension header, or as a
 * link — and a reader that takes the first and a reader that takes the last
 * disagree about what the package is. Anything ambiguous is refused here
 * instead of resolved one way and hoped about.
 *
 * Read in process rather than through `tar`, so the job that holds a publishing
 * credential runs one program and no more.
 */

import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

/** What a tarball says it is. */
export interface PackedManifest {
	name?: string
	version?: string
	private?: boolean
}

export class TarballError extends Error {}

const BLOCK = 512

const NAME = { start: 0, length: 100 }
const MODE = { start: 100, length: 8 }
const SIZE = { start: 124, length: 12 }
const CHECKSUM = { start: 148, length: 8 }
const TYPE = 156
const PREFIX = { start: 345, length: 155 }

/** A regular file. Historic writers use a NUL where the standard says `0`. */
const REGULAR = new Set(['0', '\0'])
/** Headers that describe the entry after them rather than a file of their own. */
const PAX_FILE = 'x'
const PAX_GLOBAL = 'g'
const GNU_LONG_NAME = 'L'
const GNU_LONG_LINK = 'K'

interface Field {
	start: number
	length: number
}

const text = (block: Buffer, { start, length }: Field) =>
	block
		.subarray(start, start + length)
		.toString('latin1')
		.replace(/\0[\s\S]*$/, '')
		.trim()

/**
 * A numeric header field, which tar writes as octal digits.
 *
 * The base-256 encoding used for values too large for the field is refused
 * rather than decoded: nothing in a package tarball needs it, and a reader that
 * accepts two encodings is a reader that can be pointed at the wrong number.
 */
function octal(block: Buffer, field: Field, what: string): number {
	if (block[field.start] & 0x80)
		throw new TarballError(`${what} is base-256 encoded, which this reader does not accept`)

	const digits = text(block, field)
	if (!/^[0-7]+$/.test(digits)) throw new TarballError(`${what} is ${JSON.stringify(digits)}, which is not octal`)

	const value = Number.parseInt(digits, 8)
	if (!Number.isSafeInteger(value) || value < 0) throw new TarballError(`${what} is out of range: ${digits}`)

	return value
}

/**
 * Whether a header's bytes add up to the checksum it carries.
 *
 * Summed with the checksum field itself read as spaces, which is how the field
 * is defined. Both the unsigned and the signed reading are accepted, because
 * writers have historically differed over whether the bytes are signed.
 */
function checksumMatches(header: Buffer): boolean {
	const stored = octal(header, CHECKSUM, 'the header checksum')

	let unsigned = 0
	let signed = 0
	for (let i = 0; i < BLOCK; i++) {
		const byte = i >= CHECKSUM.start && i < CHECKSUM.start + CHECKSUM.length ? 0x20 : header[i]
		unsigned += byte
		signed += byte > 127 ? byte - 256 : byte
	}

	return stored === unsigned || stored === signed
}

/**
 * The pax keys this reader understands.
 *
 * `path` is the one that matters: it renames the entry that follows, and
 * getting it wrong is the difference between what this checks and what npm
 * publishes. The rest describe times and ownership, which nothing here reads
 * and which cannot change how the archive is parsed.
 *
 * Everything else is refused rather than ignored — `size` would move where the
 * next header begins, `linkpath` would change what an entry points at, and a
 * key this reader has never heard of may mean something to the unpacker.
 */
const PAX_KEYS = new Set(['path', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname'])

/**
 * A pax header's records, read by the byte lengths they declare.
 *
 * Each record is `<length> <key>=<value>\n`, and the length counts itself. That
 * framing exists because a value may hold anything at all, newlines included,
 * so a reader that scans for delimiters instead of counting bytes can be handed
 * a value that hides a second record inside it.
 *
 * A key appearing twice is refused: implementations differ over whether the
 * first or the last wins, and a header where that matters is a header that
 * means two things.
 */
function paxRecords(data: Buffer, where: string): Map<string, string> {
	const records = new Map<string, string>()
	let offset = 0

	while (offset < data.length) {
		const space = data.indexOf(0x20, offset)
		if (space === -1) throw new TarballError(`${where} holds a record with no length`)

		const digits = data.subarray(offset, space).toString('latin1')
		if (!/^\d+$/.test(digits)) throw new TarballError(`${where} holds a record length of ${JSON.stringify(digits)}`)

		const length = Number(digits)
		const header = space - offset + 1
		if (!Number.isSafeInteger(length) || length <= header || offset + length > data.length) {
			throw new TarballError(`${where} holds a record ${length} bytes long, which does not fit the header`)
		}

		const record = data.subarray(offset, offset + length)
		if (record[length - 1] !== 0x0a) throw new TarballError(`${where} holds a record that does not end where it said`)

		const body = record.subarray(header, length - 1).toString('utf8')
		const equals = body.indexOf('=')
		if (equals === -1) throw new TarballError(`${where} holds a record with no key`)

		const key = body.slice(0, equals)
		if (!PAX_KEYS.has(key)) throw new TarballError(`${where} sets ${JSON.stringify(key)}, which this reader refuses`)
		if (records.has(key)) throw new TarballError(`${where} sets ${key} twice, so what it means is ambiguous`)

		records.set(key, body.slice(equals + 1))
		offset += length
	}

	return records
}

export interface TarEntry {
	path: string
	/** The tar type flag: `0` for a regular file, `1` and `2` for links, `5` for a directory. */
	type: string
	/** The permission bits, which decide whether an unpacked bin is runnable. */
	mode: number
	contents: Buffer
}

/**
 * Every entry in a gzipped tar archive, with extension headers already applied.
 *
 * A pax or GNU header renames the entry that follows it, so both are read and
 * the name they carry replaces the one in the next header. A pax global header
 * would rename everything after it instead, which no package tarball does and
 * this refuses outright.
 */
export function readTarball(path: string): TarEntry[] {
	const archive = gunzipSync(readFileSync(path))
	const entries: TarEntry[] = []
	let override: string | null = null
	let offset = 0

	while (offset + BLOCK <= archive.length) {
		const header = archive.subarray(offset, offset + BLOCK)

		// a zero block ends the archive
		if (header.every(byte => byte === 0)) break

		if (!checksumMatches(header)) throw new TarballError(`${path} holds a header whose checksum does not match it`)

		const size = octal(header, SIZE, 'an entry size')
		const start = offset + BLOCK
		if (start + size > archive.length)
			throw new TarballError(`${path} holds an entry running past the end of the archive`)

		const data = archive.subarray(start, start + size)
		const type = String.fromCharCode(header[TYPE])
		offset = start + Math.ceil(size / BLOCK) * BLOCK

		// A global header applies to every entry after it, including ones written
		// before anyone thought about this archive. No package tarball carries one.
		if (type === PAX_GLOBAL) throw new TarballError(`${path} carries a global pax header, which applies to everything`)

		if (type === PAX_FILE) {
			override = paxRecords(data, `${path}: a pax header`).get('path') ?? override
			continue
		}
		if (type === GNU_LONG_NAME) {
			override = data.toString('utf8').replace(/\0[\s\S]*$/, '')
			continue
		}
		if (type === GNU_LONG_LINK) continue

		const prefix = text(header, PREFIX)
		const name = text(header, NAME)
		const mode = octal(header, MODE, 'an entry mode')
		entries.push({ path: override ?? (prefix ? `${prefix}/${name}` : name), type, mode, contents: data })
		override = null
	}

	return entries
}

/**
 * The one file an archive holds at a path, or null if it holds none.
 *
 * Two entries claiming one path is an archive that means different things to
 * different readers, so it is refused rather than resolved. So is a link at
 * that path: what it resolves to is decided by whoever unpacks it.
 */
export function readFromTarball(path: string, wanted: string): Buffer | null {
	const matching = readTarball(path).filter(entry => entry.path === wanted)
	if (matching.length === 0) return null

	if (matching.length > 1) {
		throw new TarballError(
			`${path} holds ${matching.length} entries called ${wanted}, so what it contains is ambiguous`
		)
	}
	if (!REGULAR.has(matching[0].type)) {
		throw new TarballError(`${path} holds ${wanted} as type ${JSON.stringify(matching[0].type)} rather than a file`)
	}

	return matching[0].contents
}

/** The manifest npm would read out of this tarball when it publishes it. */
export function readPackedManifest(path: string): PackedManifest {
	const bytes = readFromTarball(path, 'package/package.json')
	if (!bytes) throw new TarballError(`${path} holds no package/package.json, so it is not a package tarball`)

	try {
		return JSON.parse(bytes.toString('utf8')) as PackedManifest
	} catch (error) {
		throw new TarballError(`${path} holds a package.json that is not valid JSON: ${(error as Error).message}`)
	}
}
