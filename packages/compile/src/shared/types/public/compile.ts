export const targets = ['node', 'browser', 'worker'] as const
export type Target = (typeof targets)[number]

export const presets = ['node', 'browser', 'edge'] as const
export type Preset = (typeof presets)[number]

export const formats = ['cjs', 'es'] as const
export type Format = (typeof formats)[number]

export const userBundlers = ['vite', 'rollup', 'esbuild', 'webpack', 'rspack'] as const
export type UserBundler = (typeof userBundlers)[number]

export const assetModes = ['static', 'dynamic', 'none'] as const
export type AssetMode = (typeof assetModes)[number]

export const outputs = ['renderer', 'html'] as const
export type Output = (typeof outputs)[number]

export interface CompileOptions {
	target?: Target
	preset?: Preset
	bundle?: string[]
	external?: string[]
	conditions?: string[]
	externalConditions?: string[]
	documents?: string[]
	assets?: AssetMode | null
	output?: Output | null
	variants?: string[]
	remoteAssets?: boolean
	inlineRemoteCss?: boolean
	validateSchema?: boolean
	cjs?: boolean
	bundleName?: string
	version?: string | null
	clean?: boolean
	outDir?: string | null
	configPath?: string | null
	/** @internal */
	userBundler?: UserBundler | null
}

// Include preset-derived fields that don't exist on the input options
type NormalizedExtras = {
	bundleAll: boolean
	assets: AssetMode
	output: Output
}

export type NormalizedCompileOptions = {
	[K in keyof CompileOptions]-?: CompileOptions[K]
} & NormalizedExtras
