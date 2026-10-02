// A user-facing failure: printed as a plain message without a stack trace.
export class CliError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'CliError'
	}
}
