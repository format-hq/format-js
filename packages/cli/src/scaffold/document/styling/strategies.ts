import type {
	ApplyStyleArgs,
	CheckPrerequisitesArgs,
	GeneratedFile,
	MissingDependency,
	ProjectSetupResult,
	SetupProjectArgs,
	StyleApplication,
	StylingStrategy
} from '../types.ts'

import { STYLING_SUPPORT, STYLING_DEPENDENCIES } from '../../shared.ts'
import { buildReport, readProjectDependencies, requireDependency, satisfied } from './prerequisites.ts'
import { setupPanda } from '../panda-setup.ts'
import { EMPTY_STYLESHEET_COMMENT } from '../types.ts'

// The starter's layout: centre the heading and hint on the page. The heading
// uses Format's default sans (no font-family override); the hint uses the
// `--font-mono` token, which is what the fonts docs advise for de-emphasised UI text.
const STARTER_CSS = `:host {
	display: flex;
	flex-direction: column;
	justify-content: center;
	text-align: center;
}

h1 {
	margin-block: 0.5rem;
	font-size: 1.5rem;
}

.hint {
	margin: 0;
	opacity: 0.5;
	font-family: var(--font-mono);
}
`

// Tailwind styles the heading and hint with utilities in the markup, so the
// stylesheet only carries the layout that has no direct utility (`:host`).
//
// Tailwind's default theme redefines --font-sans/serif/mono with system font
// stacks (Menlo, Apple Color Emoji, ...). Those named fonts aren't embedded, so
// they render differently across machines and trip the engine's font diagnostic.
// The @theme block points them back at Format's built-in families.
const TAILWIND_CSS = `@import 'tailwindcss';

@theme {
	--font-sans: var(--font-sans-system);
	--font-serif: var(--font-serif-system);
	--font-mono: var(--font-mono-system);
}

:host {
	display: flex;
	flex-direction: column;
	justify-content: center;
	text-align: center;
}
`

// An empty Tailwind document still needs the directive and the theme (without them
// Tailwind produces no styles and the font families fall back to unembedded system
// stacks), but not the demo `:host` centring.
const TAILWIND_EMPTY_CSS = `@import 'tailwindcss';

@theme {
	--font-sans: var(--font-sans-system);
	--font-serif: var(--font-serif-system);
	--font-mono: var(--font-mono-system);
}

${EMPTY_STYLESHEET_COMMENT}`

// Preflight resets heading size and weight to inherit, so the heading names them
// back explicitly; the hint mirrors the plain-CSS starter (opacity + mono font).
const TAILWIND_HEADING_CLASS = 'my-2 text-2xl font-bold'
const TAILWIND_HINT_CLASS = 'm-0 opacity-50 font-mono'

// The heading and hint are scoped `style()` exports the entry binds by class —
// the idiomatic vanilla-extract approach. Only the page-host centring stays a
// `globalStyle`, since `style()` scopes to a class and can't reach the `:host`.
const STARTER_VANILLA_EXTRACT = `import { globalStyle, style } from '@vanilla-extract/css'

globalStyle(':host', {
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'center',
	textAlign: 'center'
})

export const title = style({
	marginBlock: '0.5rem',
	fontSize: '1.5rem'
})

export const hint = style({
	margin: 0,
	opacity: 0.5,
	fontFamily: 'var(--font-mono)'
})
`

// Linaria's point is scoped, co-located `styled` components, so the heading and
// hint are their own components (Title, Hint) with their own classes. Only the
// page-host centring stays a global `css` + `:global()` block, because `styled`
// generates component classes and can't reach the shadow `:host`.
// Exported so it reads as an intentional global (Linaria's documented pattern)
// and isn't flagged as an unused local — the class itself is never applied.
const LINARIA_HOST_STYLES = `export const hostStyles = css\`
	:global() {
		:host {
			display: flex;
			flex-direction: column;
			justify-content: center;
			text-align: center;
		}
	}
\``

const LINARIA_TITLE = `const Title = styled.h1\`
	margin-block: 0.5rem;
	font-size: 1.5rem;
\``

const LINARIA_HINT = `const Hint = styled.p\`
	margin: 0;
	opacity: 0.5;
	font-family: var(--font-mono);
\``

// The common case: the heading and hint are plain elements styled by the method's
// stylesheet (or Vue <style> block). The hint carries a literal `hint` class.
function elementApplication(imports: string[], vueStyleBlock?: string): StyleApplication {
	return { imports, declarations: [], headingTag: 'h1', hintTag: 'p', hintClass: 'hint', vueStyleBlock }
}

// Tailwind carries its styles as utility classes on the heading and hint instead
// of a `.hint` rule in the stylesheet.
function tailwindApplication(imports: string[], vueStyleBlock?: string): StyleApplication {
	return {
		imports,
		declarations: [],
		headingTag: 'h1',
		hintTag: 'p',
		headingClass: TAILWIND_HEADING_CLASS,
		hintClass: TAILWIND_HINT_CLASS,
		vueStyleBlock
	}
}

const cssStrategy: StylingStrategy = {
	method: 'css',
	frameworks: STYLING_SUPPORT['css'],
	files(): GeneratedFile[] {
		return [{ path: 'styles.css', contents: STARTER_CSS }]
	},
	apply({ framework }: ApplyStyleArgs): StyleApplication {
		if (framework === 'vue') {
			return elementApplication([], "<style>\n@import './styles.css';\n</style>")
		}

		return elementApplication(["import './styles.css'"])
	},
	async checkPrerequisites() {
		return satisfied('css')
	}
}

const cssModulesStrategy: StylingStrategy = {
	method: 'css-modules',
	frameworks: STYLING_SUPPORT['css-modules'],
	files(): GeneratedFile[] {
		return [{ path: 'styles.module.css', contents: STARTER_CSS }]
	},
	apply(): StyleApplication {
		// Import the module as an object and bind `styles.hint` so the scoped
		// class shows off CSS Module scoping, rather than a literal `.hint`.
		return {
			imports: ["import styles from './styles.module.css'"],
			declarations: [],
			headingTag: 'h1',
			hintTag: 'p',
			hintClassExpr: 'styles.hint'
		}
	},
	async checkPrerequisites() {
		return satisfied('css-modules')
	}
}

const scopedStrategy: StylingStrategy = {
	method: 'vue-sfc-scoped',
	frameworks: STYLING_SUPPORT['vue-sfc-scoped'],
	files(): GeneratedFile[] {
		return []
	},
	apply(): StyleApplication {
		return elementApplication([], `<style scoped>\n${STARTER_CSS}</style>`)
	},
	async checkPrerequisites() {
		return satisfied('vue-sfc-scoped')
	}
}

const scssStrategy: StylingStrategy = {
	method: 'scss',
	frameworks: STYLING_SUPPORT['scss'],
	files(): GeneratedFile[] {
		return [{ path: 'styles.scss', contents: STARTER_CSS }]
	},
	apply({ framework }: ApplyStyleArgs): StyleApplication {
		if (framework === 'vue') {
			return elementApplication([], '<style lang="scss">\n@use \'./styles.scss\';\n</style>')
		}

		return elementApplication(["import './styles.scss'"])
	},
	async checkPrerequisites() {
		// Studio ships sass-embedded transitively, so user projects don't need to install anything.
		return satisfied('scss')
	}
}

const tailwindStrategy: StylingStrategy = {
	method: 'tailwind',
	frameworks: STYLING_SUPPORT['tailwind'],
	files(): GeneratedFile[] {
		return [{ path: 'styles.css', contents: TAILWIND_CSS }]
	},
	emptyFiles(): GeneratedFile[] {
		return [{ path: 'styles.css', contents: TAILWIND_EMPTY_CSS }]
	},
	apply({ framework }: ApplyStyleArgs): StyleApplication {
		if (framework === 'vue') {
			return tailwindApplication([], "<style>\n@import './styles.css';\n</style>")
		}

		return tailwindApplication(["import './styles.css'"])
	},
	async checkPrerequisites({ projectRoot }: CheckPrerequisitesArgs) {
		const installed = await readProjectDependencies(projectRoot)
		return requireDependency({ method: 'tailwind', dependency: 'tailwindcss', installed })
	}
}

const linariaStrategy: StylingStrategy = {
	method: 'linaria',
	frameworks: STYLING_SUPPORT['linaria'],
	files(): GeneratedFile[] {
		return []
	},
	apply(): StyleApplication {
		return {
			imports: ["import { css } from '@linaria/core'", "import { styled } from '@linaria/react'"],
			declarations: [LINARIA_HOST_STYLES, LINARIA_TITLE, LINARIA_HINT],
			headingTag: 'Title',
			hintTag: 'Hint'
		}
	},
	async checkPrerequisites({ projectRoot }: CheckPrerequisitesArgs) {
		const installed = await readProjectDependencies(projectRoot)
		const missingDependencies: MissingDependency[] = STYLING_DEPENDENCIES.linaria
			.filter(dependency => !installed.has(dependency))
			.map(name => ({ name, dev: true }))

		return buildReport({ method: 'linaria', missingDependencies, missingConfig: [] })
	}
}

const vanillaExtractStrategy: StylingStrategy = {
	method: 'vanilla-extract',
	frameworks: STYLING_SUPPORT['vanilla-extract'],
	files(): GeneratedFile[] {
		return [{ path: 'styles.css.ts', contents: STARTER_VANILLA_EXTRACT }]
	},
	apply(): StyleApplication {
		return {
			imports: ["import { title, hint } from './styles.css'"],
			declarations: [],
			headingTag: 'h1',
			hintTag: 'p',
			headingClassExpr: 'title',
			hintClassExpr: 'hint'
		}
	},
	async checkPrerequisites({ projectRoot }: CheckPrerequisitesArgs) {
		const installed = await readProjectDependencies(projectRoot)
		return requireDependency({ method: 'vanilla-extract', dependency: '@vanilla-extract/css', installed })
	}
}

// Panda styles are co-located `css({...})` calls bound by class — the Panda idiom.
// The generated `styled-system` and the `styles/styles.css` layer file come from
// the project-wide setup (setupProject), which runs when the user opts into installs.
const PANDA_TITLE = `const title = css({
	marginBlock: '0.5rem',
	fontSize: '1.5rem'
})`

const PANDA_HINT = `const hint = css({
	margin: 0,
	opacity: 0.5,
	fontFamily: 'var(--font-mono)'
})`

const pandaStrategy: StylingStrategy = {
	method: 'panda-css',
	frameworks: STYLING_SUPPORT['panda-css'],
	files(): GeneratedFile[] {
		return []
	},
	apply(): StyleApplication {
		return {
			imports: ["import { css } from '../../styles/styled-system/css'", "import '../../styles/styles.css'"],
			declarations: [PANDA_TITLE, PANDA_HINT],
			headingTag: 'h1',
			hintTag: 'p',
			headingClassExpr: 'title',
			hintClassExpr: 'hint'
		}
	},
	async checkPrerequisites({ projectRoot }: CheckPrerequisitesArgs) {
		const installed = await readProjectDependencies(projectRoot)
		return requireDependency({ method: 'panda-css', dependency: '@pandacss/dev', installed })
	},
	async setupProject(args: SetupProjectArgs): Promise<ProjectSetupResult> {
		const { projectRoot, formatConfigPath, documentsGlobBase } = args

		const result = await setupPanda({ projectRoot, documentsDirName: documentsGlobBase, formatConfigPath })

		const summary = [
			result.pandaConfigCreated ? 'Created panda.config.ts' : 'Reused existing Panda config',
			`Panda layer stylesheet ${result.layerCss}`,
			`prepare script ${result.prepareScript}`,
			result.formatConfigUpdated ? 'Enabled pandaCss in the Format config' : 'Left the Format config unchanged',
			result.codegen.ok ? 'Ran panda codegen' : `panda codegen failed: ${result.codegen.message ?? 'unknown error'}`
		]

		return { method: 'panda-css', ok: result.codegen.ok, summary }
	}
}

export const STYLING_STRATEGIES: StylingStrategy[] = [
	cssStrategy,
	cssModulesStrategy,
	scopedStrategy,
	scssStrategy,
	tailwindStrategy,
	linariaStrategy,
	vanillaExtractStrategy,
	pandaStrategy
]
