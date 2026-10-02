// Metadata files the major operating systems scatter into folders: macOS Finder
// state, Windows thumbnail caches and folder settings, Linux trash and lock
// files. None are real assets, so we never list, hash, or bundle them.

const EXACT_JUNK_NAMES = new Set([
	'.DS_Store', // macOS Finder
	'.Spotlight-V100', // macOS Spotlight index
	'.DocumentRevisions-V100', // macOS versioning
	'.fseventsd', // macOS file events
	'.TemporaryItems', // macOS
	'.Trashes', // macOS volume trash
	'.VolumeIcon.icns', // macOS custom volume icon
	'.apdisk', // macOS disk image metadata
	'.directory' // Linux (KDE Dolphin folder settings)
])

// Windows filenames are case-insensitive, so match these regardless of case.
const CASE_INSENSITIVE_JUNK_NAMES = new Set(['thumbs.db', 'ehthumbs.db', 'ehthumbs_vista.db', 'desktop.ini'])

/**
 * True when `name` (a single path segment, not a full path) is OS-generated
 * junk rather than a real file. Used to keep these out of asset listings,
 * archives, and cache hashes.
 */
export function isSystemJunkFile(name: string): boolean {
	if (EXACT_JUNK_NAMES.has(name)) {
		return true
	}

	if (CASE_INSENSITIVE_JUNK_NAMES.has(name.toLowerCase())) {
		return true
	}

	const isAppleDoubleFork = name.startsWith('._') // macOS resource forks
	const isLinuxTrash = name.startsWith('.Trash-') // Linux per-user trash
	const isNfsLock = name.startsWith('.nfs') // Linux NFS silly-rename locks

	return isAppleDoubleFork || isLinuxTrash || isNfsLock
}
