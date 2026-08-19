import { loadProjectState } from '../../project.ts'
import { reportNewerRelease } from '../../versioning/update-check.ts'

// Prints the pinned version and checks that every installed Format package
// agrees with it. Exits non-zero on misalignment so it doubles as a CI guard.
export async function versionCommand(cwd: string): Promise<number> {
	const state = await loadProjectState(cwd)

	if (!state.pinnedVersion) {
		console.log(`No "version" field found in ${state.configFile.filepath}.`)
		console.log('Run `format update latest` to pin the latest Format release.')

		return 1
	}

	console.log(`Format ${state.pinnedVersion}`)

	if (state.mismatches.length > 0) {
		console.log('')
		console.log('Some installed Format packages do not match the pinned version:')

		for (const mismatch of state.mismatches) {
			console.log(`  ${mismatch.name}  ${mismatch.actual} (expected ${mismatch.expected})`)
		}

		console.log('')
		console.log('Run `format update` to bring everything in line.')

		return 1
	}

	const alignedCount = state.dependencies.length

	if (alignedCount > 0) {
		const names = state.dependencies.map(dependency => dependency.name).join(', ')
		console.log(`${alignedCount} installed Format package${alignedCount === 1 ? '' : 's'}: ${names}`)
	}

	await reportNewerRelease(state.pinnedVersion)

	return 0
}
