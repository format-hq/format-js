import { SUPPORTED_FRAMEWORKS } from '../shared/types'
import { DOT_TMP_DIR_NAME, DOT_FORMAT_DIR_NAME, DEFAULT_OUT_DIR_NAME } from './project/paths'

export const CONFIG_FILE_NAME = process.env.FMT_CONFIG_FILE_NAME || 'format.config'
export const DATA_VARIANTS_DIR = 'data'
export const DEFAULT_SCHEMA_FILE_NAME = 'schema'

export const PROJECT_EXTENSIONS = {
	react: ['.tsx', '.ts', '.jsx', '.js'],
	vue: ['.vue', '.ts', '.tsx', '.js', '.jsx'],
	html: ['.ts', '.js']
}

export const PROJECT_EXTENSIONS_ALL = [...new Set(Object.values(PROJECT_EXTENSIONS).flat())]

export const SERVER_WATCH_IGNORE = [
	'**/dist/**',
	'**/node_modules/**',
	`**/${DOT_TMP_DIR_NAME}/**`,
	`**/${DOT_FORMAT_DIR_NAME}/**`,
	`**/${DEFAULT_OUT_DIR_NAME}/**`,
	// Framework build artifact directories — prevents cascading HMR when
	// the dev server runs alongside another dev server that writes to these paths.
	// Adding these just to future-proof, as it's an annoying dev bug to
	// figure out!
	'**/.next/**',
	'**/.nuxt/**',
	'**/.svelte-kit/**'
]

export const CONFIG_DOCS_URL = 'https://format.dev/docs/studio/configuration'

export const NO_CONFIG_FILE_MESSAGE = `Could not find Format config file. It should be named ${CONFIG_FILE_NAME}.{json|jsonc} and placed in the root of your repo.`
export const INVALID_FRAMEWORK_MESSAGE = `Invalid framework. Your Format config must specify a "framework" field. Must be one of: ${SUPPORTED_FRAMEWORKS.join(', ')}`
