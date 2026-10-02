import type { SerializedError } from './types'

/**
 * Serialize an error for IPC transport. Preserves name, message, stack, the
 * custom `data` property used by FormatRenderError, and the `missing`/`known`
 * asset lists an AssetMismatchError carries (the class itself can't survive IPC).
 */
export function serializeError(error: unknown): SerializedError {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			code: (error as any).code,
			data: (error as any).data,
			missing: (error as any).missing,
			known: (error as any).known,
			remoteRefs: (error as any).remoteRefs
		}
	}

	return {
		name: 'Error',
		message: String(error)
	}
}

/**
 * Reconstruct an Error instance from a serialized representation.
 */
export function deserializeError(serialized: SerializedError): Error {
	const error = new Error(serialized.message)
	error.name = serialized.name

	if (serialized.stack) {
		error.stack = serialized.stack
	}

	if (serialized.code !== undefined) {
		;(error as any).code = serialized.code
	}

	if (serialized.data !== undefined) {
		;(error as any).data = serialized.data
	}

	if (serialized.missing !== undefined) {
		;(error as any).missing = serialized.missing
	}

	if (serialized.known !== undefined) {
		;(error as any).known = serialized.known
	}

	if (serialized.remoteRefs !== undefined) {
		;(error as any).remoteRefs = serialized.remoteRefs
	}

	return error
}
