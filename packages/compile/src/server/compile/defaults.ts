import type { CompileOptions, NormalizedCompileOptions, Preset, Target } from '../../shared/types/public'
import { logger } from '../utils/log'
import { resolveBundleName } from './bundle-name'
import { DEFAULT_BUNDLE_NAME } from './constants'

function uniq(arr: string[]) {
	return [...new Set(arr)]
}

interface PresetDefaults {
	target: Target
	bundleAll: boolean
	conditions: string[]
	externalConditions: string[]
}

function presetDefaults(preset?: Preset): PresetDefaults {
	if (preset === 'browser') {
		return {
			target: 'browser',
			bundleAll: true,
			conditions: [],
			externalConditions: []
		}
	}

	if (preset === 'edge') {
		return {
			target: 'worker',
			bundleAll: true,
			conditions: ['workerd', 'worker', 'browser', 'module'],
			externalConditions: ['workerd', 'worker', 'browser', 'node']
		}
	}

	if (preset === 'node') {
		return {
			target: 'node',
			bundleAll: false,
			conditions: [],
			externalConditions: []
		}
	}

	throw new Error(`Invalid preset: ${preset}`)
}

const DEFAULTS = {
	documents: [] as string[],
	external: [] as string[],
	bundle: [] as string[],
	assets: 'static',
	output: 'renderer',
	variants: [] as string[],
	remoteAssets: false,
	inlineRemoteCss: false,
	validateSchema: true,
	cjs: false,
	bundleName: DEFAULT_BUNDLE_NAME,
	version: null,
	clean: true,
	outDir: null,
	configPath: null,
	target: 'node',
	preset: 'node',
	conditions: [],
	externalConditions: [],
	userBundler: null
} satisfies Required<CompileOptions>

const warnIgnored = (message: string) => logger.warn(`ℹ ${message}`)
const warnRisky = (message: string) => logger.warn(`⚠ ${message}`)

/**
 * Surface incompatible option combinations at normalisation time, so the user
 * learns as soon as options are read rather than deep in the pipeline. Every
 * combination here is ignored or risky, never build-breaking, so the intent is
 * warn-and-continue — matching how the pipeline has always treated them.
 *
 * HTML output is excluded: it force-overrides the JS-bundle options and warns
 * per flag in `warnIncompatibleHtmlOptions` instead.
 */
export function warnIncompatibleOptionCombos(options: NormalizedCompileOptions) {
	if (options.output === 'html') {
		return
	}

	if (options.variants.length > 0) {
		warnIgnored('The --variants flag only applies to html output, ignoring.')
	}

	if (options.remoteAssets && options.assets !== 'static') {
		const reason =
			options.assets === 'dynamic'
				? 'dynamic bundles build their zip at render time in your runtime'
				: 'none mode emits no assets'

		warnIgnored(`remoteAssets applies to static mode only — ${reason}. It will be ignored.`)
	}

	if (options.remoteAssets && options.assets === 'static' && options.target !== 'node') {
		warnIgnored(
			`remoteAssets requires a node-target compile, where the document renders at build time — ` +
				`target: "${options.target}" bundles never render during the build. It will be ignored.`
		)
	}

	// bundle/external rules are preset defaults. Users can still specify overrides (warn only).
	if (options.target === 'browser' && options.bundle.length) {
		warnIgnored(
			'The bundle option is ignored for target: "browser". All packages are bundled by default. Use the "external" option to exclude packages from the bundle.'
		)
	}

	if (options.target === 'node' && options.external.length) {
		warnIgnored(
			'The external option is ignored for target: "node". All packages are externalized by default (and need to be installed where you call render). Use the "bundle" option to include packages in the bundle.'
		)
	}

	if (options.preset === 'edge' && options.bundle.length) {
		warnIgnored(
			'The bundle option is ignored for preset: "edge". All packages are bundled by default. Use the "external" option to exclude packages from the bundle.'
		)
	}

	if (options.preset === 'edge') {
		if (options.external.length) {
			warnRisky(
				'Using "external" with preset: "edge" means those packages must be provided by your edge runtime environment. In most cases, you want everything bundled.'
			)
		}
		if (options.cjs) {
			warnRisky('preset: "edge" commonly requires ESM. Using --cjs may not work in your edge runtime.')
		}
	}

	if (options.preset === 'browser' && options.external.length) {
		warnRisky(
			'Using "external" with preset: "browser" means those packages must be resolved by the consumer bundler at runtime.'
		)
	}

	if (options.target === 'worker' && options.external.length) {
		warnRisky(
			'Using "external" with target: "worker" means those packages must be provided by your worker runtime environment.'
		)
	}

	if (options.target === 'worker' && options.cjs) {
		warnRisky('target: "worker" commonly requires ESM. Using --cjs may not work in your worker runtime.')
	}
}

export function normalizeCompileOptions(input: CompileOptions): NormalizedCompileOptions {
	const preset: Preset | undefined = input.preset ?? DEFAULTS.preset
	const presetConfig = presetDefaults(preset)

	const target: Target = input.target ?? presetConfig.target
	const bundleAll = preset === 'edge' ? true : presetConfig.bundleAll

	const documents = input.documents ?? DEFAULTS.documents
	const external = input.external ?? DEFAULTS.external
	const bundle = input.bundle ?? DEFAULTS.bundle

	const conditions = uniq([...(presetConfig.conditions ?? []), ...(input.conditions ?? DEFAULTS.conditions)])
	const externalConditions = uniq([
		...(presetConfig.externalConditions ?? []),
		...(input.externalConditions ?? DEFAULTS.externalConditions)
	])

	const normalized: NormalizedCompileOptions = {
		documents,
		external,
		bundle,
		assets: input.assets ?? DEFAULTS.assets,
		output: input.output ?? DEFAULTS.output,
		variants: input.variants ?? DEFAULTS.variants,
		remoteAssets: input.remoteAssets ?? DEFAULTS.remoteAssets,
		validateSchema: input.validateSchema ?? DEFAULTS.validateSchema,
		inlineRemoteCss: input.inlineRemoteCss ?? DEFAULTS.inlineRemoteCss,
		cjs: input.cjs ?? DEFAULTS.cjs,
		bundleName: resolveBundleName(input.bundleName ?? DEFAULTS.bundleName),
		version: input.version ?? DEFAULTS.version,
		clean: input.clean ?? DEFAULTS.clean,
		outDir: input.outDir ?? DEFAULTS.outDir,
		target,
		preset,
		configPath: input.configPath ?? DEFAULTS.configPath,
		bundleAll,
		conditions,
		externalConditions,
		userBundler: input.userBundler ?? DEFAULTS.userBundler
	}

	warnIncompatibleOptionCombos(normalized)

	return normalized
}
