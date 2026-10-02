// Declared here rather than imported from `@pandacss/dev/postcss`, because Panda
// is an optional peer dependency that most consumers never install. Importing it
// would carry the reference into this file's published declaration and fail for
// anyone who left the optional peer out, since TypeScript checks declaration
// files unless `skipLibCheck` is turned on. The fields mirror `PluginOptions`
// from `@pandacss/postcss`, so a value of that type still satisfies this one.
/**
 * Options for the Panda CSS PostCSS plugin.
 */
export interface PandaCssPostCssPluginOptions {
	configPath?: string
	cwd?: string
	logfile?: string
	allow?: RegExp[]
}

export const SUPPORTED_FRAMEWORKS = ['react', 'vue', 'html'] as const
export type Framework = (typeof SUPPORTED_FRAMEWORKS)[number]

export interface FormatConfig {
	/**
	 * Path or URL to the JSON schema for this file, used by editors for
	 * autocomplete and validation. Set it to: https://format.dev/schema/format-config.json.
	 *
	 * @example "https://format.dev/schema/format-config.json"
	 * */
	$schema?: string

	/**
	 * The Format release version this project is pinned to. Every installed Format
	 * package is kept in lockstep with this version. Set it to the version you
	 * want and run `format update` to apply it everywhere. Must be an exact
	 * version, never a range.
	 *
	 * @example "0.1.2"
	 * */
	version: string

	/**
	 * Which framework to use for your Format documents.
	 * */
	framework: Framework

	/**
	 * The root directory where all Format code is located, relative to the config file. Change this if you want to root your Format documents and data under a different directory. For example, setting this to "format" would result in your documents being located in "format/documents".
	 *
	 * @example "format"
	 *
	 * @default "./"
	 *
	 * */
	rootDir?: string

	/**
	 * The directory for assets shared across documents, as a relative path. Defaults to `assets` under the root dir, mirroring each document's own `./assets/` folder. In your template code, this resolves as `"./"`: place `image.png` in this directory and reference it as `"./image.png"`. Somewhat equivalent to a `public` dir in a Vite project.
	 *
	 * @default "assets"
	 * @example "./shared-assets"
	 *
	 * */
	sharedAssetsDir?: string

	/**
	 * Override the base path resolution for Format. Useful if you want to have your config in a different directory to the root of your project. For example, if you put your `format.config.json` file in a `config` directory, you could set `cwd` to `../` to tell Format to look for your project in the parent directory.
	 *
	 * @example "../"
	 *
	 * @default process.cwd()
	 *
	 * */
	cwd?: string

	/**
	 * Specify a path to a `.env` file. If path is relative, this is resolved relative to `cwd`.
	 *
	 * @example "../../.env"
	 *
	 * @default resolve(cwd, .env)
	 *
	 * */
	dotEnvPath?: string

	/**
	 * Panda CSS configuration options. The `PandaCssPostCssPluginOptions` type is exposed as `PluginOptions` from the `@pandacss/dev/postcss` package. Useful resource: https://github.com/chakra-ui/panda/blob/main/packages/postcss/src/index.ts
	 *
	 * @default {
	 * 	enabled: false,
	 * 	postCssConfig: {
	 * 		cwd: rootDir || "./",
	 * 		configPath: resolve(rootDir || "./", "panda.config.ts")
	 *  }
	 * }
	 */
	pandaCss?: {
		/**
		 * Enable Panda CSS processing.
		 */
		enabled?: boolean

		/**
		 * Panda CSS PostCSS plugin options. Useful if your Panda config is located in a non-standard location.
		 */
		postCssConfig?: PandaCssPostCssPluginOptions
	}
}

// Runtime list of every valid config key. The FormatConfig type is erased at
// runtime, so unknown-key detection in loadConfig needs a real array to diff
// against. Keep this in sync when adding or removing a config option.
export const KNOWN_CONFIG_KEYS: readonly (keyof FormatConfig)[] = [
	'$schema',
	'version',
	'framework',
	'rootDir',
	'sharedAssetsDir',
	'cwd',
	'dotEnvPath',
	'pandaCss'
]
