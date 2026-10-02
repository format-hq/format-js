export const DEFAULT_BUNDLE_NAME = 'documents'
export const BUNDLE_ENTRY_POINT_FILE_NAME = 'index.js'
export const STYLES_BY_FILE_REPLACEMENT = '__FMT_STYLES_BY_FILE__'
export const ENTRY_CSS_FILES_REPLACEMENT = '__FMT_ENTRY_CSS_FILES__'

// Output directories at the bundle root. `shared-assets/` holds everything
// shared across documents — the `sharedAssetsDir` contents plus the assets Vite
// emits (imported images + fonts). `chunks/` holds shared JS/CSS chunks.
export const SHARED_ASSETS_OUT_DIR_NAME = 'shared-assets'
export const CHUNKS_DIR_NAME = 'chunks'

// A document compiles to its own `<name>/` dir at the bundle root, so its name
// can't collide with a reserved output dir. Deliberately defined locally, NOT
// re-exported from @format.dev/cli/scaffold: this file is imported by document-side
// compile code, and a scaffold import would bundle the whole scaffold module
// into compiled document chunks. Keep in step with the copy in
// packages/cli/src/scaffold/document/validate-name.ts.
export const RESERVED_DOCUMENT_NAMES = [SHARED_ASSETS_OUT_DIR_NAME, CHUNKS_DIR_NAME]
