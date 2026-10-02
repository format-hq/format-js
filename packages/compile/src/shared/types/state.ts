import type { Framework } from './public/config'

export interface State {
	currentOrgId?: string
	engineVersion?: string
	enginePath?: string
	// The project framework, so the client can filter framework-specific options
	// (e.g. styling methods in the new-document modal).
	framework?: Framework
	// Basename of the project root, for display only (e.g. the CLI tab's terminal prompt).
	projectName?: string
	// The active environment's format.dev web URL, so the app builds docs links
	// that follow FMT_ENV instead of a build-time constant.
	webUrl?: string
	// Which known styling/schema dependencies are already in the project, so the
	// new-document modal can show real "missing dep" counts instead of totals.
	installedDependencies?: string[]
}
