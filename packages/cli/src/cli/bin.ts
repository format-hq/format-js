#!/usr/bin/env node
import { createProgram } from './index.ts'
import { CliError } from '../errors.ts'

try {
	await createProgram().parseAsync()
} catch (error) {
	if (error instanceof CliError) {
		console.error(error.message)
		process.exitCode = 1
	} else {
		throw error
	}
}
