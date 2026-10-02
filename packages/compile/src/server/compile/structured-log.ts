export type StructuredOutputStatus = 'success' | 'error'

export interface StructuredOutputError {
	name?: string
	message: string
}

export interface StructuredOutput {
	documentName: string
	outDir: string
	compiledIn: string
	status: StructuredOutputStatus
	error?: StructuredOutputError
}

function toStructuredError(error: unknown): StructuredOutputError {
	if (error && typeof error === 'object') {
		const maybeError = error as { name?: unknown; message?: unknown }
		const name = typeof maybeError.name === 'string' ? maybeError.name : undefined
		const message = typeof maybeError.message === 'string' ? maybeError.message : JSON.stringify(error)
		return { name, message }
	}

	return { message: String(error) }
}

export function createStructuredOutput(args: {
	documentName: string
	outDir: string
	compiledIn: string
	error?: unknown
}): StructuredOutput {
	const { documentName, outDir, compiledIn, error } = args

	if (error !== undefined) {
		return {
			documentName,
			outDir,
			compiledIn,
			status: 'error',
			error: toStructuredError(error)
		}
	}

	return {
		documentName,
		outDir,
		compiledIn,
		status: 'success'
	}
}
