export type {
	ApplyStyleArgs,
	CheckPrerequisitesArgs,
	CreateDocumentArgs,
	CreateDocumentResult,
	GeneratedFile,
	MissingConfig,
	MissingDependency,
	PrerequisiteReport,
	ProjectSetupResult,
	ScaffoldProjectConfig,
	SetupProjectArgs,
	StyleApplication,
	StylingMethod,
	StylingStrategy,
	TemplateId
} from './document/types.ts'
export { DEFAULT_TEMPLATE, EMPTY_STYLESHEET_COMMENT } from './document/types.ts'

export type { DocumentPlan } from './document/create-document.ts'

export {
	buildDocumentPlan,
	createDocument,
	getDocumentsDir,
	readExistingDocumentNames,
	writeDocument,
	DOCUMENTS_DIR_NAME
} from './document/create-document.ts'

export type { InstallSummary, MaybeInstallArgs, MaybeSetupProjectArgs } from './document/install.ts'

export { maybeInstallDependencies, maybeSetupProject } from './document/install.ts'

export type { ValidateDocumentNameResult } from './document/validate-name.ts'

export { validateDocumentName, suggestAvailableName, RESERVED_DOCUMENT_NAMES } from './document/validate-name.ts'

export { generateRandomName } from './document/random-name.ts'
export { drawRandomName } from './document/draw-random-name.ts'

export { resolveStyling, STYLING_STRATEGIES } from './document/styling/index.ts'
export { readProjectDependencies } from './document/styling/prerequisites.ts'

export { RESERVED_WORDS, buildDocumentExportMap, getDocumentExportName } from './document/document-names.ts'

export { methodsForFramework } from './shared.ts'

export { CliError } from '../errors.ts'
