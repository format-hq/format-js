import { cancel, isCancel } from '@clack/prompts'

// Thrown when the user cancels a prompt (Ctrl-C or Esc). Command boundaries
// catch it and exit cleanly with code 0, so a cancel is never an error.
export class PromptCancelledError extends Error {
	constructor() {
		super('Prompt cancelled')
		this.name = 'PromptCancelledError'
	}
}

export function isPromptCancelledError(error: unknown): boolean {
	return error instanceof PromptCancelledError
}

// Unwrap a @clack prompt result. A cancel prints the cancel line and throws the
// sentinel the command boundary turns into a clean exit, so callers can treat
// the return value as the resolved answer.
export function requirePrompt<Value>(value: Value | symbol): Value {
	if (isCancel(value)) {
		cancel('Cancelled.')

		throw new PromptCancelledError()
	}

	return value as Value
}
