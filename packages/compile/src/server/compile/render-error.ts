import { CompileError } from '../errors'

export const DOCUMENT_RENDER_FAILED_CODE = 'DOCUMENT_RENDER_FAILED'

function readStringArray(source: unknown, key: string): string[] | undefined {
	const value = (source as Record<string, unknown> | null)?.[key]

	if (!Array.isArray(value)) {
		return undefined
	}

	return value.filter((item): item is string => typeof item === 'string')
}

/**
 * Whether a render failure is an asset mismatch (the rendered HTML referenced
 * assets the bundle cannot supply). Checked via the `code` field rather than
 * `instanceof` because the class is lost crossing the render worker's IPC
 * boundary — only the serialized fields survive.
 */
export function isAssetMismatchFailure(error: unknown): boolean {
	return (error as { code?: unknown } | null)?.code === 'ASSET_MISMATCH'
}

const failureMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export interface DocumentRenderErrorArgs {
	documentName: string
	variant: string
	cause: unknown
}

/**
 * A per-document render failure inside a compile. Multi-document builds throw
 * this so the error itself names the document (and variant) that broke, and an
 * asset mismatch reads differently from a crash in the document's component.
 *
 * The cause's asset lists are copied onto this error because consumers (e.g.
 * the download middleware) read `missing`/`brokenRemote` structurally off
 * whatever a failed compile throws.
 */
export class DocumentRenderError extends CompileError {
	readonly documentName: string
	readonly variant: string
	declare missing?: string[]
	declare known?: string[]
	declare remoteRefs?: string[]
	declare brokenRemote?: string[]

	constructor(args: DocumentRenderErrorArgs) {
		const { documentName, variant, cause } = args

		const isAssetMismatch = isAssetMismatchFailure(cause)
		const reason = isAssetMismatch
			? 'the rendered HTML references assets the bundle cannot supply'
			: 'the document threw while rendering'

		super({
			code: DOCUMENT_RENDER_FAILED_CODE,
			message: `Document "${documentName}" (variant "${variant}") failed to render: ${reason}.\n\n${failureMessage(cause)}`,
			cause
		})

		this.name = 'DocumentRenderError'
		this.documentName = documentName
		this.variant = variant

		if (isAssetMismatch) {
			this.missing = readStringArray(cause, 'missing')
			this.known = readStringArray(cause, 'known')
			this.remoteRefs = readStringArray(cause, 'remoteRefs')
			this.brokenRemote = readStringArray(cause, 'brokenRemote')
		}
	}
}
