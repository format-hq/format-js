import type { Framework, SchemaKind, StylingMethod } from '../../scaffold/shared.ts'
import type { PrerequisiteReport, ScaffoldProjectConfig } from '../../scaffold/document/types.ts'

import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

import pc from 'picocolors'

import { intro, outro, text, select, confirm, log } from '@clack/prompts'

import { findConfigPath, readConfigFile } from '../../config.ts'
import { CliError } from '../../errors.ts'
import { requirePrompt, isPromptCancelledError } from '../../prompts.ts'
import {
	DEFAULT_STYLING,
	STYLING_LABELS,
	SCHEMA_KINDS,
	SCHEMA_LABELS,
	PAGE_SIZES,
	DEFAULT_PAGE_SIZE_ID,
	isValidDimension,
	isStylingMethod,
	methodsForFramework
} from '../../scaffold/shared.ts'
import { createDocument, getDocumentsDir, readExistingDocumentNames } from '../../scaffold/document/create-document.ts'
import { generateRandomName } from '../../scaffold/document/random-name.ts'
import { validateDocumentName } from '../../scaffold/document/validate-name.ts'
import { writeDocumentDependencies, maybeSetupProject } from '../../scaffold/document/install.ts'
import { finalizeDependencies } from '../../scaffold/finalize-dependencies.ts'

const STUDIO_URL = 'http://localhost:1234'

type SchemaChoice = 'none' | SchemaKind

export interface NewDocumentOptions {
	styling?: StylingMethod
	schema?: string
	data?: string
	size?: string
	width?: string
	height?: string
	install?: boolean
	yes?: boolean
	empty?: boolean
	// Set when `format init` runs this as its final step: skip the intro/outro
	// (this renders inside init's flow) and list init's packages in the one
	// install prompt.
	embedded?: boolean
	incomingDependencies?: string[]
}

async function resolveName(args: {
	provided: string | undefined
	existingNames: string[]
	skipPrompts: boolean
}): Promise<string> {
	const { provided, existingNames, skipPrompts } = args

	if (provided) {
		return provided
	}

	const suggestion = generateRandomName({ existingNames })

	if (skipPrompts) {
		return suggestion
	}

	const answer = requirePrompt(
		await text({
			message: 'Document name',
			defaultValue: suggestion,
			placeholder: suggestion,
			validate: value => {
				// Empty means "accept the default", so don't validate it — the
				// suggestion applies. Only validate what the user actually typed.
				if (!value) {
					return undefined
				}

				const result = validateDocumentName({ name: value, existingNames })
				return result.ok ? undefined : result.reason
			}
		})
	)

	return answer || suggestion
}

async function resolveStylingMethod(args: {
	provided: StylingMethod | undefined
	framework: Framework
	skipPrompts: boolean
}): Promise<StylingMethod> {
	const { provided, framework, skipPrompts } = args

	if (provided) {
		return provided
	}

	if (skipPrompts) {
		return DEFAULT_STYLING
	}

	const methods = methodsForFramework(framework)

	return requirePrompt(
		await select<StylingMethod>({
			message: 'Styling method',
			initialValue: DEFAULT_STYLING,
			options: methods.map(method => ({ value: method, label: STYLING_LABELS[method] }))
		})
	)
}

function isSchemaChoice(value: string): value is SchemaChoice {
	return value === 'none' || (SCHEMA_KINDS as string[]).includes(value)
}

async function resolveSchema(args: { provided: string | undefined; skipPrompts: boolean }): Promise<SchemaChoice> {
	const { provided, skipPrompts } = args

	if (provided !== undefined) {
		if (!isSchemaChoice(provided)) {
			throw new CliError(`Invalid --schema: "${provided}". Choices: none, ${SCHEMA_KINDS.join(', ')}.`)
		}

		return provided
	}

	if (skipPrompts) {
		return 'none'
	}

	return requirePrompt(
		await select<SchemaChoice>({
			message: 'Schema',
			initialValue: 'none',
			options: [
				{ value: 'none', label: 'None' },
				...SCHEMA_KINDS.map(kind => ({ value: kind, label: SCHEMA_LABELS[kind] }))
			]
		})
	)
}

function parseDimension(args: { flag: string; value: string }): number {
	const { flag, value } = args
	const parsed = Number(value)

	if (!isValidDimension(parsed)) {
		throw new CliError(`Invalid ${flag}: "${value}". Enter a number of CSS pixels from 1 to 20000.`)
	}

	return parsed
}

interface Dimensions {
	width: number
	height: number
}

async function promptCustomDimensions(): Promise<Dimensions> {
	// Empty means "accept the default", so let it through and coalesce below.
	const dimensionValidator = (value: string | undefined) => {
		if (!value) {
			return undefined
		}

		return isValidDimension(Number(value)) ? undefined : 'Enter a number of CSS pixels from 1 to 20000.'
	}

	const width = requirePrompt(
		await text({ message: 'Width (px)', defaultValue: '794', placeholder: '794', validate: dimensionValidator })
	)

	const height = requirePrompt(
		await text({ message: 'Height (px)', defaultValue: '1123', placeholder: '1123', validate: dimensionValidator })
	)

	return { width: Number(width || '794'), height: Number(height || '1123') }
}

async function resolveDimensions(args: {
	size: string | undefined
	width: string | undefined
	height: string | undefined
	skipPrompts: boolean
}): Promise<Dimensions | undefined> {
	const { size, width, height, skipPrompts } = args

	if (width !== undefined && height !== undefined) {
		return {
			width: parseDimension({ flag: '--width', value: width }),
			height: parseDimension({ flag: '--height', value: height })
		}
	}

	if (size && size !== 'custom') {
		const match = PAGE_SIZES.find(candidate => candidate.id === size)

		if (!match) {
			const ids = PAGE_SIZES.map(candidate => candidate.id).join(', ')
			throw new CliError(`Invalid --size: "${size}". Choices: ${ids}, custom.`)
		}

		return { width: match.width, height: match.height }
	}

	if (size === 'custom' && (width === undefined || height === undefined)) {
		if (skipPrompts) {
			throw new CliError('--size custom requires --width and --height.')
		}

		return promptCustomDimensions()
	}

	if (skipPrompts || size !== undefined) {
		return undefined
	}

	const choice = requirePrompt(
		await select<string>({
			message: 'Page size',
			initialValue: DEFAULT_PAGE_SIZE_ID,
			options: [
				...PAGE_SIZES.map(candidate => ({ value: candidate.id, label: `${candidate.name} (${candidate.label})` })),
				{ value: 'custom', label: 'Custom…' }
			]
		})
	)

	if (choice === 'custom') {
		return promptCustomDimensions()
	}

	const match = PAGE_SIZES.find(candidate => candidate.id === choice)
	return match ? { width: match.width, height: match.height } : undefined
}

// Load and parse the JSON data file for the default variant. Returns undefined
// when no file is given; throws a clear error when the file is missing or invalid.
export async function resolveData(args: { provided: string | undefined; skipPrompts: boolean }): Promise<unknown> {
	const { provided, skipPrompts } = args

	const path = provided ?? (skipPrompts ? undefined : await promptDataPath())

	if (!path) {
		return undefined
	}

	const resolved = resolve(process.cwd(), path)

	let raw: string
	try {
		raw = await readFile(resolved, 'utf8')
	} catch {
		throw new CliError(`Couldn't read the data file at "${path}".`)
	}

	try {
		return JSON.parse(raw)
	} catch {
		throw new CliError(`The data file at "${path}" isn't valid JSON.`)
	}
}

async function promptDataPath(): Promise<string | undefined> {
	// A confirm gate makes the optionality explicit: one Enter skips (the common
	// case), rather than overloading a blank text input to mean "skip".
	const wantsData = requirePrompt(
		await confirm({ message: 'Seed the default variant from a JSON file?', initialValue: false })
	)

	if (!wantsData) {
		return undefined
	}

	const path = requirePrompt(
		await text({
			message: 'Path to the JSON file',
			placeholder: './data.json',
			validate: value => (value && value.trim() !== '' ? undefined : 'Enter a path, or press Ctrl+C to skip.')
		})
	)

	return path.trim()
}

// Only report genuine config setup here. Missing dependencies are handled by
// the unified install flow, so they're deliberately not repeated.
function reportPrerequisites(prerequisites: PrerequisiteReport) {
	if (prerequisites.missingConfig.length === 0) {
		return
	}

	const steps = prerequisites.missingConfig.map(config => `• ${config.description}`)
	log.warn(`To finish setting up ${STYLING_LABELS[prerequisites.method]}:\n${steps.join('\n')}`)
}

function isFramework(value: unknown): value is Framework {
	return value === 'react' || value === 'vue' || value === 'html'
}

interface LoadedProject {
	config: ScaffoldProjectConfig
	projectRoot: string
	formatConfigPath: string
}

async function loadProject(cwd: string): Promise<LoadedProject> {
	// FMT_CONFIG_FILE_NAME is the internal base-name override Studio's test
	// fixtures use; honoured here so scaffolding targets the same file.
	const configPath = findConfigPath(cwd, { baseName: process.env.FMT_CONFIG_FILE_NAME })

	if (!configPath) {
		throw new CliError(
			'No Format project found here. Run `npm create format@latest` to start a project, then try again.'
		)
	}

	const configFile = await readConfigFile(configPath)
	const framework = configFile.config.framework

	if (!isFramework(framework)) {
		throw new CliError(`Invalid "framework" in ${configPath}: expected "react", "vue", or "html".`)
	}

	const rootDir = typeof configFile.config.rootDir === 'string' ? configFile.config.rootDir : undefined

	return {
		config: { framework, rootDir },
		projectRoot: dirname(configPath),
		formatConfigPath: configPath
	}
}

export async function newDocumentCommand(
	cwd: string,
	name: string | undefined,
	options: NewDocumentOptions
): Promise<number> {
	const project = await loadProject(cwd)
	const { config, projectRoot, formatConfigPath } = project

	const empty = options.empty === true
	const skipPrompts = options.yes === true
	const embedded = options.embedded === true
	const incomingDependencies = options.incomingDependencies ?? []
	const documentsDir = getDocumentsDir({ projectRoot, config })
	const existingNames = await readExistingDocumentNames(documentsDir)

	try {
		if (!embedded) {
			intro(pc.bgCyan(pc.black(' Format ')))
		}

		const resolvedName = await resolveName({ provided: name, existingNames, skipPrompts })
		const styling = await resolveStylingMethod({
			provided: options.styling,
			framework: config.framework,
			skipPrompts
		})

		// --empty has no data prop to type or seed, so the schema and data prompts
		// don't apply — skip them and let createDocument force no schema and {} data.
		// Styling and page size still apply and prompt.
		const schemaChoice = empty ? 'none' : await resolveSchema({ provided: options.schema, skipPrompts })
		const emitSchema = schemaChoice !== 'none'
		const schemaKind = schemaChoice === 'none' ? undefined : schemaChoice
		const data = empty ? undefined : await resolveData({ provided: options.data, skipPrompts })
		const dimensions = await resolveDimensions({
			size: options.size,
			width: options.width,
			height: options.height,
			skipPrompts
		})

		const result = await createDocument({
			config,
			projectRoot,
			name: resolvedName,
			styling,
			emitSchema,
			schemaKind,
			data,
			width: dimensions?.width,
			height: dimensions?.height,
			empty
		})

		// Record the document's styling and schema libraries in package.json, then
		// run the single install decision over everything added this flow — the
		// caller's packages plus the document's. Install first, then announce
		// success, so the "Created" and "Open in Studio" lines land last.
		const documentDependencies = await writeDocumentDependencies({
			projectRoot,
			emitSchema,
			schemaKind,
			missingStylingDependencies: result.prerequisites.missingDependencies.map(dependency => dependency.name)
		})

		const finalize = await finalizeDependencies({
			projectDir: projectRoot,
			addedDependencies: [...incomingDependencies, ...documentDependencies],
			install: options.install === false ? false : undefined,
			skipPrompts
		})

		if (finalize.result && !finalize.installed) {
			log.error(`Failed to install dependencies automatically: ${finalize.result.message ?? 'unknown error'}`)
		}

		// Project-wide setup (Panda) after deps, gated on the same install opt-in.
		const projectSetup = await maybeSetupProject({
			wanted: finalize.wantInstall,
			styling,
			config,
			projectRoot,
			formatConfigPath,
			documentsGlobBase: relative(projectRoot, documentsDir)
		})

		if (projectSetup) {
			log.success(`Set up ${styling}\n${projectSetup.summary.map(line => pc.dim(line)).join('\n')}`)
		}

		log.success(`Created document ${pc.cyan(result.documentName)}\n${pc.dim(result.documentDir)}`)

		// When we installed, project setup ran too, so config is handled. Only
		// surface remaining config steps when the user opted out of installing.
		if (!finalize.installed) {
			reportPrerequisites(result.prerequisites)
		}

		const openLine = `Open it in Studio: ${pc.cyan(`${STUDIO_URL}/${result.documentName}`)}`

		if (embedded) {
			log.info(openLine)
		}

		if (!embedded) {
			outro(openLine)
		}

		return 0
	} catch (error) {
		if (isPromptCancelledError(error)) {
			return 0
		}

		const message = error instanceof Error ? error.message : String(error)
		log.error(message)

		return 1
	}
}
