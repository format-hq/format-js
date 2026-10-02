import type { CssConcat } from '../../shared/types'

export interface DocumentModule {
	id: string | null
	importedModules: Set<DocumentModule>
}

interface InvalidateModuleTreeArgs<Module extends DocumentModule> {
	entry: Module | undefined
	invalidate: (module: Module) => void
}

interface CollectDocumentCssArgs {
	entry: DocumentModule | undefined
	css: CssConcat
}

function walkModuleTree<Module extends DocumentModule>(entry: Module, visit: (module: Module) => void) {
	const seen = new Set<Module>()

	const walk = (module: Module) => {
		if (seen.has(module)) {
			return
		}

		seen.add(module)
		visit(module)
		module.importedModules.forEach(imported => walk(imported as Module))
	}

	walk(entry)
}

/** Force the next load to transform and evaluate every module the document imports again. */
export function invalidateModuleTree<Module extends DocumentModule>(args: InvalidateModuleTreeArgs<Module>) {
	const { entry, invalidate } = args

	if (!entry) {
		return
	}

	walkModuleTree(entry, invalidate)
}

/**
 * Join the CSS of every style module the document imports, in import order.
 * Vite skips the transform for a module another document already loaded, so
 * the CSS has to come from what was stored at its last transform, not from
 * what this render happened to transform.
 */
export function collectDocumentCss(args: CollectDocumentCssArgs): string {
	const { entry, css } = args

	if (!entry) {
		return ''
	}

	const styles: string[] = []

	walkModuleTree(entry, module => {
		const moduleCss = module.id ? css.get(module.id) : undefined

		if (moduleCss !== undefined) {
			styles.push(moduleCss)
		}
	})

	return styles.join('')
}
