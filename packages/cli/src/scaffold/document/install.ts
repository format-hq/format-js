import type { ProjectSetupResult, ScaffoldProjectConfig, StylingMethod } from './types.ts'
import type { SchemaKind } from '../shared.ts'

import { SCHEMA_DEPENDENCIES, DEFAULT_SCHEMA_KIND } from '../shared.ts'
import { recommendedVersion } from '../recommended-versions.ts'
import { installManifest, writeDependenciesToManifest } from '../dependencies.ts'
import { readProjectDependencies } from './styling/prerequisites.ts'
import { resolveStyling } from './styling/index.ts'

export interface WriteDocumentDependenciesArgs {
	projectRoot: string
	emitSchema: boolean
	schemaKind?: SchemaKind
	missingStylingDependencies: string[]
}

// Writes the dependency set a new document needs into package.json at the
// recommended versions — styling deps the project is missing, plus the schema
// library when one is emitted. Does not install; the caller runs a single
// install for the whole flow. Returns the names actually added.
export async function writeDocumentDependencies(args: WriteDocumentDependenciesArgs): Promise<string[]> {
	const { projectRoot, emitSchema, schemaKind, missingStylingDependencies } = args

	const installed = await readProjectDependencies(projectRoot)

	const candidates = [...missingStylingDependencies]

	if (emitSchema) {
		candidates.push(SCHEMA_DEPENDENCIES[schemaKind ?? DEFAULT_SCHEMA_KIND])
	}

	const names = [...new Set(candidates)].filter(name => !installed.has(name))

	const dependencies = names.map(name => ({ name, version: recommendedVersion(name), dev: true }))

	return writeDependenciesToManifest({ projectDir: projectRoot, dependencies })
}

export interface InstallSummary {
	requested: boolean
	attempted: boolean
	ok: boolean
	packages: string[]
	packageManager?: string
	message?: string
	// The tail of the package manager's own output, present only on failure.
	output?: string
}

export interface MaybeInstallArgs {
	wanted: boolean
	projectRoot: string
	emitSchema: boolean
	schemaKind?: SchemaKind
	missingStylingDependencies: string[]
	// Called with the resolved package list right before the install runs, so a
	// caller can report progress. Not called when nothing installs.
	onInstallStart?: (packages: string[]) => void
	// Called for each line the package manager prints, so a caller can show live
	// progress. The output is captured either way and never reaches stdout.
	onProgress?: (line: string) => void
}

// Studio's install-now path: write the document's dependencies at the
// recommended versions, then (when opted in) install the whole manifest so the
// packages exist before the document is written. The CLI uses the deferred,
// single-prompt flow in scaffold/dependencies.ts instead.
export async function maybeInstallDependencies(args: MaybeInstallArgs): Promise<InstallSummary> {
	const { wanted, projectRoot, emitSchema, schemaKind, missingStylingDependencies, onInstallStart } = args

	const packages = await writeDocumentDependencies({ projectRoot, emitSchema, schemaKind, missingStylingDependencies })

	if (!wanted || packages.length === 0) {
		return { requested: wanted, attempted: false, ok: true, packages }
	}

	onInstallStart?.(packages)

	const result = await installManifest({ projectDir: projectRoot, onProgress: args.onProgress })

	return {
		requested: true,
		attempted: true,
		ok: result.ok,
		packages,
		packageManager: result.packageManager,
		message: result.message,
		output: result.output
	}
}

export interface MaybeSetupProjectArgs {
	// Gated on the same opt-in as installs, since setup mutates project files.
	wanted: boolean
	styling: string | undefined
	config: ScaffoldProjectConfig
	projectRoot: string
	// Absolute path to the Format config file, for methods that amend it.
	formatConfigPath: string
	// The documents directory relative to the project root, e.g. 'documents'.
	documentsGlobBase: string
}

// Run a styling method's project-wide setup (Panda today) after deps install. Only
// methods that need it implement `setupProject`; everything else returns null.
export async function maybeSetupProject(args: MaybeSetupProjectArgs): Promise<ProjectSetupResult | null> {
	const { wanted, styling, config, projectRoot, formatConfigPath, documentsGlobBase } = args

	if (!wanted || styling === undefined) {
		return null
	}

	const strategy = resolveStyling({ framework: config.framework, method: styling as StylingMethod })

	if (!strategy.setupProject) {
		return null
	}

	return strategy.setupProject({ config, projectRoot, formatConfigPath, documentsGlobBase })
}
