import type { AssetMode, Target } from './compile'

export interface FormatUnpluginOptions {
	/**
	 * The output target for the compiled bundle.
	 *
	 * @default "node"
	 */
	target?: Target

	/**
	 * Asset mode. See [`--assets`](/docs/cli/compile#assets) for more information on the available modes.
	 */
	assets?: AssetMode | null

	/**
	 * Subdirectory within your bundler's output directory where compiled `assets.zip`
	 * output is placed. Useful when you want to keep assets separate from your JS output.
	 * Resulting structure: `{bundler outDir}/{assetsOutDir?}/{documentName}/assets.zip`.
	 * This path is not affected by setting bundler asset dirs, like Vite's `build.assetsDir`.
	 *
	 * @summary Specify a subdirectory for the `assets.zip`.
	 * @example "./assets"
	 */
	assetsOutDir?: string

	/**
	 * Inline remote CSS at compile time. See [`--inline-remote-css`](/docs/cli/compile#inline-remote-css).
	 *
	 * @default false
	 */
	inlineRemoteCss?: boolean

	/**
	 * Validate render data against your schema. See [`--no-validate-schema`](/docs/cli/compile#validate-schema).
	 *
	 * @default true
	 */
	validateSchema?: boolean

	/**
	 * A custom name for the compiled bundle and virtual module.
	 * Sets the virtual module import to `@format:<bundleName>`.
	 *
	 * @example "my-docs"
	 * @default "documents"
	 */
	bundleName?: string

	/**
	 * Whether to clear the Format output directory before recompiling.
	 *
	 * @default true
	 */
	clean?: boolean

	/**
	 * Override the base internal output directory for the compiled Format bundle. See [`--out-dir`](/docs/cli/compile#out-dir).
	 * Rarely needs to be changed. Resulting structure: `{bundler outDir}/{outDir}/{documentName}...`
	 *
	 * @default <rootDir>/_generated
	 */
	outDir?: string | null

	/**
	 * Explicit path to your `format.config.*` file. Useful if your config is in a non-standard location.
	 */
	configPath?: string | null
}
