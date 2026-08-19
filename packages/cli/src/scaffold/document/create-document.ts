import type {
	ApplyStyleArgs,
	CreateDocumentArgs,
	CreateDocumentResult,
	GeneratedFile,
	PrerequisiteReport,
	ScaffoldProjectConfig,
	StyleApplication,
	StylingStrategy
} from './types.ts'

import fs from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { CliError } from '../../errors.ts'
import { DEFAULT_STYLING, DEFAULT_TEMPLATE, EMPTY_STYLESHEET_COMMENT } from './types.ts'
import { DEFAULT_PAGE_WIDTH, DEFAULT_PAGE_HEIGHT } from '../shared.ts'
import { validateDocumentName } from './validate-name.ts'
import { resolveStyling } from './styling/index.ts'
import { getDocumentExportName } from './document-names.ts'
import { buildDataFile, buildEntryFiles, buildGitkeepFile, buildSchemaFile } from './templates/index.ts'
import { formatGeneratedFile } from './format.ts'

export const DOCUMENTS_DIR_NAME = 'documents'

interface GetDocumentsDirArgs {
	projectRoot: string
	config: ScaffoldProjectConfig
}

// The documents directory derives from the project root (the directory holding
// the Format config) via the config's rootDir, mirroring Studio's paths.
export function getDocumentsDir(args: GetDocumentsDirArgs): string {
	const { projectRoot, config } = args

	return join(resolve(projectRoot, config.rootDir || './'), DOCUMENTS_DIR_NAME)
}

export async function readExistingDocumentNames(documentsDir: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(documentsDir, { withFileTypes: true })
		return entries.filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(entry => entry.name)
	} catch {
		// No documents directory yet — the first document creates it.
		return []
	}
}

interface WriteFilesArgs {
	documentDir: string
	files: GeneratedFile[]
	projectRoot: string
}

async function writeFiles(args: WriteFilesArgs): Promise<void> {
	const { documentDir, files, projectRoot } = args

	await Promise.all(
		files.map(async file => {
			const fullPath = join(documentDir, file.path)
			await fs.mkdir(dirname(fullPath), { recursive: true })

			const contents = await formatGeneratedFile({ contents: file.contents, filePath: fullPath, projectRoot })
			await fs.writeFile(fullPath, contents, 'utf8')
		})
	)
}

// The shared seam both the CLI and the HTTP endpoint call. It does no prompting
// and no process.exit: it validates, throws a typed CliError on invalid input or
// conflict, writes the tree, and returns a structured result.
// A validated, fully-computed document ready to write to disk. Splitting the plan
// from the write lets callers install dependencies and run project setup (e.g.
// Panda codegen) *before* the files land, so a document that imports generated
// output is never on disk in an unrenderable state.
export interface DocumentPlan {
	documentName: string
	documentDir: string
	files: GeneratedFile[]
	prerequisites: PrerequisiteReport
	// Carried so writeDocument can resolve the project's Prettier.
	projectRoot: string
}

// A side-effect import pulls a module in for its effects, e.g. `import './styles.css'`.
// Binding imports (`import styles from …`, `import { title } from …`) only exist to
// name styles the entry applies, so an empty entry has no use for them.
function isSideEffectImport(statement: string): boolean {
	return /^\s*import\s+['"]/.test(statement)
}

// The styling application for an empty document: keep the side-effect stylesheet
// imports (and a Vue <style> block that only pulls in a stylesheet), drop the class
// bindings, declarations, and binding imports that would style a heading and hint
// the empty entry never renders.
function toEmptyApplication(application: StyleApplication): StyleApplication {
	const vueStyleBlockPullsInFile = application.vueStyleBlock ? /@(import|use)/.test(application.vueStyleBlock) : false

	return {
		imports: application.imports.filter(isSideEffectImport),
		declarations: [],
		headingTag: application.headingTag,
		hintTag: application.hintTag,
		vueStyleBlock: vueStyleBlockPullsInFile ? application.vueStyleBlock : undefined
	}
}

// The stylesheet files for an empty document. A method that carries required
// boilerplate (Tailwind's `@import`/`@theme`) provides a stripped version through
// emptyFiles; every other method's stylesheet is pure demo, so it's replaced with
// a placeholder comment.
function emptyStylingFiles(strategy: StylingStrategy, args: ApplyStyleArgs): GeneratedFile[] {
	if (strategy.emptyFiles) {
		return strategy.emptyFiles(args)
	}

	return strategy.files(args).map(file => ({ ...file, contents: EMPTY_STYLESHEET_COMMENT }))
}

export async function buildDocumentPlan(args: CreateDocumentArgs): Promise<DocumentPlan> {
	const {
		config,
		projectRoot,
		name,
		template = DEFAULT_TEMPLATE,
		schemaKind,
		width = DEFAULT_PAGE_WIDTH,
		height = DEFAULT_PAGE_HEIGHT,
		empty = false
	} = args

	// --empty controls content only: a static title, no data prop, an empty Layout,
	// and an empty stylesheet. The styling method is respected, so it composes with
	// --styling. A schema is skipped, since the empty entry has no data prop to type.
	const styling = args.styling ?? DEFAULT_STYLING
	const emitSchema = empty ? false : (args.emitSchema ?? false)

	// The data variant seeded to default.json. Empty documents seed {} since the
	// entry doesn't read it; otherwise fall back to a single `title` field so the
	// starter renders something.
	const data = empty ? {} : args.data !== undefined ? args.data : { title: name }

	if (template !== 'blank') {
		throw new CliError(`Unknown template "${template}". Only "blank" is supported.`)
	}

	const documentsDir = getDocumentsDir({ projectRoot, config })
	const existingNames = await readExistingDocumentNames(documentsDir)

	const validation = validateDocumentName({ name, existingNames })

	if (!validation.ok) {
		const suffix = validation.suggestion ? ` Try "${validation.suggestion}".` : ''
		throw new CliError(`${validation.reason}${suffix}`)
	}

	const documentDir = join(documentsDir, name)

	const strategy = resolveStyling({ framework: config.framework, method: styling })
	const exportName = getDocumentExportName(name)
	const applyArgs = { framework: config.framework, documentName: name, exportName }
	const fullApplication = strategy.apply(applyArgs)

	// An empty document renders no heading or hint, so its entry drops everything
	// that only styles them (class bindings, declarations, binding imports) while
	// keeping side-effect stylesheet imports wired up.
	const application = empty ? toEmptyApplication(fullApplication) : fullApplication

	// An empty document strips the method's demo styles. Most methods have nothing
	// but demo styles, so their stylesheet is emptied; methods with required
	// boilerplate (Tailwind's directives) provide it through emptyFiles.
	const stylingFiles = empty ? emptyStylingFiles(strategy, applyArgs) : strategy.files(applyArgs)

	const files: GeneratedFile[] = [
		...buildEntryFiles({
			framework: config.framework,
			documentName: name,
			application,
			width,
			height,
			emitSchema,
			data,
			empty
		}),
		...stylingFiles,
		buildDataFile(data),
		buildGitkeepFile()
	]

	if (emitSchema) {
		files.push(buildSchemaFile(name, schemaKind, data))
	}

	const prerequisites = await strategy.checkPrerequisites({ config, projectRoot })

	return { documentName: name, documentDir, files, prerequisites, projectRoot }
}

export async function writeDocument(plan: DocumentPlan): Promise<void> {
	try {
		await writeFiles({ documentDir: plan.documentDir, files: plan.files, projectRoot: plan.projectRoot })
	} catch (error) {
		// Don't leave a half-written directory behind.
		await fs.rm(plan.documentDir, { recursive: true, force: true })

		const message = error instanceof Error ? error.message : 'Unknown error'
		throw new CliError(`Failed to write document "${plan.documentName}": ${message}`)
	}
}

export async function createDocument(args: CreateDocumentArgs): Promise<CreateDocumentResult> {
	const plan = await buildDocumentPlan(args)
	await writeDocument(plan)

	return {
		documentName: plan.documentName,
		documentDir: plan.documentDir,
		filesWritten: plan.files.map(file => file.path),
		prerequisites: plan.prerequisites
	}
}
