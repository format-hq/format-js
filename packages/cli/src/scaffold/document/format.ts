import { extname, join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

interface PrettierOptions {
	parser?: string
	[key: string]: unknown
}

interface PrettierModule {
	format(contents: string, options: PrettierOptions): Promise<string>
	resolveConfig(filePath: string): Promise<PrettierOptions | null>
}

// Generated files are formatted by extension. HTML is intentionally absent: the
// entry carries Eta tags (`<%= data.title %>`) that Prettier's HTML parser would
// choke on or mangle, and that file is simple enough to emit hand-formatted.
const PARSER_BY_EXTENSION: Record<string, string> = {
	'.tsx': 'typescript',
	'.ts': 'typescript',
	'.jsx': 'babel',
	'.js': 'babel',
	'.vue': 'vue',
	'.css': 'css',
	'.scss': 'scss',
	'.json': 'json'
}

// Format's own conventions, used only when the project has no Prettier config of
// its own. The project's config (resolved from the target path) always wins.
const FALLBACK_OPTIONS: PrettierOptions = {
	useTabs: true,
	singleQuote: true,
	semi: false
}

const prettierByProject = new Map<string, Promise<PrettierModule | null>>()

// The CLI doesn't ship Prettier. Resolve it lazily from the user's project, so a
// project that has it gets house-style output and one that doesn't still works.
function loadProjectPrettier(projectRoot: string): Promise<PrettierModule | null> {
	const cached = prettierByProject.get(projectRoot)

	if (cached) {
		return cached
	}

	const loading = (async () => {
		try {
			const requireFromProject = createRequire(join(projectRoot, 'package.json'))
			const entryPath = requireFromProject.resolve('prettier')
			const module = (await import(pathToFileURL(entryPath).href)) as PrettierModule | { default: PrettierModule }

			return 'format' in module ? module : module.default
		} catch {
			return null
		}
	})()

	prettierByProject.set(projectRoot, loading)
	return loading
}

interface FormatGeneratedFileArgs {
	contents: string
	// Absolute path the file will be written to. Picks the parser and locates the
	// project's Prettier config.
	filePath: string
	// The user's project root, where Prettier is resolved from.
	projectRoot: string
}

// Pretty-print a generated file with the project's own Prettier so the scaffold
// matches the user's house style. Falls back to the raw contents for unknown
// extensions, empty files, a project without Prettier, or anything Prettier can't
// parse — a formatting hiccup must never block document creation.
export async function formatGeneratedFile(args: FormatGeneratedFileArgs): Promise<string> {
	const { contents, filePath, projectRoot } = args

	const parser = PARSER_BY_EXTENSION[extname(filePath)]

	if (!parser || !contents.trim()) {
		return contents
	}

	const prettier = await loadProjectPrettier(projectRoot)

	if (!prettier) {
		return contents
	}

	try {
		const projectConfig = await prettier.resolveConfig(filePath)
		return await prettier.format(contents, { ...FALLBACK_OPTIONS, ...projectConfig, parser })
	} catch {
		return contents
	}
}
