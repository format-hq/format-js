export interface ErrorProperties {
	code?: string
	message?: string
	stack?: string
	hint?: string
	docs?: string
	details?: string
	cause?: unknown
}

export class CompileError extends Error {
	declare code?: string
	declare hint?: string
	declare docs?: string
	declare details?: string
	declare cause?: unknown

	constructor(arg: string | ErrorProperties) {
		if (typeof arg === 'string') {
			super(arg)
			this.name = 'CompileError'
			Error.captureStackTrace?.(this, CompileError)
			return
		}

		super(arg.message ?? '')
		this.name = 'CompileError'

		if (arg.code) this.code = arg.code
		if (arg.hint) this.hint = arg.hint
		if (arg.docs) this.docs = arg.docs
		if (arg.details) this.details = arg.details
		if (arg.cause) this.cause = arg.cause

		if (arg.stack) {
			this.stack = arg.stack
		} else {
			Error.captureStackTrace?.(this, CompileError) as any
		}
	}
}
