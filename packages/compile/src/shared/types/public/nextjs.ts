import type { AssetMode, Target } from './compile'

export type { FormatAssetConfig, FormatDocument, FormatRenderer } from './renderer'

/**
 * Per-target compile options. When set at the top level of
 * `FormatNextPluginOptions`, they act as defaults for all targets.
 * When set inside a target config, they override the top-level default.
 */
export interface FormatTargetOptions {
	/**
	 * The output target.
	 * - `node`: Node.js servers. Framework deps externalized by default.
	 * - `browser`: Client-side. All deps bundled by default.
	 * - `worker`: Edge runtimes. All deps bundled by default.
	 *
	 * `@format:<bundleName>` always resolves to the first target.
	 *
	 * Every target also gets a suffixed alias:
	 *
	 * - node    → `format:<bundleName>/node`
	 * - browser → `format:<bundleName>/browser`
	 * - worker  → `format:<bundleName>/edge`
	 *
	 * @summary The output target.
	 */
	target: Target

	/**
	 * Asset mode for this target. See [`--assets`](/docs/cli/compile#assets) for more information on the available modes.
	 */
	assets?: AssetMode | null

	/**
	 * Whether to inline remote CSS for this target. See [`--inline-remote-css`](/docs/cli/compile#inline-remote-css) for more information.
	 *
	 * @default false
	 */
	inlineRemoteCss?: boolean

	/**
	 * Whether to validate against schema for this target.
	 *
	 * @default true
	 */
	validateSchema?: boolean

	/**
	 * Packages to force-bundle (node target).
	 * The node target externalizes all deps by default. Use this for
	 * packages that won't be in node_modules at runtime. See [`--bundle`](/docs/cli/compile#bundle) for more information.
	 *
	 * @example ['date-fns', 'lodash']
	 */
	bundle?: string[]

	/**
	 * Packages to externalize (browser/worker targets).
	 * These targets bundle all deps by default. Use this for
	 * packages your runtime already provides. See [`--external`](/docs/cli/compile#external) for more information.
	 *
	 * @example ['react', 'react-dom']
	 */
	external?: string[]
}

export interface FormatNextPluginOptions {
	/**
	 * Compile to multiple targets with per-target options.
	 * @default [{ target: 'node' }]
	 */
	targets?: FormatTargetOptions[]

	// ── Shared defaults (overridable per-target) ──

	/**
	 * Default asset mode for all targets. Overridden by target-level `assets`.
	 * See [`--assets`](/docs/cli/compile#assets) for more information on the available modes.
	 * @summary Default asset mode for all targets. Overridden by target-level `assets`.
	 * @default "static"
	 */
	assets?: AssetMode | null

	/**
	 * Whether to inline remote CSS for all targets. Overridden by target-level `inlineRemoteCss`.
	 * See [`--inline-remote-css`](/docs/cli/compile#inline-remote-css) for more information.
	 * @summary Inline remote CSS for all targets. Overridden by target-level `inlineRemoteCss`.
	 * @default false
	 */
	inlineRemoteCss?: boolean

	/**
	 * Whether to validate against schema for all targets. Overridden by target-level `validateSchema`.
	 * @default true
	 */
	validateSchema?: boolean

	// ── Global options (not per-target) ──

	/**
	 * Name for the compiled bundle and virtual module prefix.
	 * Sets the import alias to `@format:<bundleName>`.
	 *
	 * @default "documents"
	 */
	bundleName?: string

	/**
	 * Clear the output directory before recompiling.
	 * @default true
	 */
	clean?: boolean

	/**
	 * Override the output directory.
	 * @default <rootDir>/_generated
	 */
	outDir?: string | null

	/**
	 * Explicit path to `format.config.*`.
	 */
	configPath?: string | null
}
