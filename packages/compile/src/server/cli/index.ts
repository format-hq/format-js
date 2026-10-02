import {
	type CliArgumentSpec,
	type CliCommandSpec,
	type CliOptionSpec,
	type CliSpec,
	type CompileOptions
} from '../../shared/types/public'
import { Command, Option } from 'commander'
import { compile } from '../compile'
import cliSpecJson from './cli-spec.json'

export type CommandHandler = (...args: any[]) => unknown

function handleCommaSeparatedList(val: string, prev: string[] = []) {
	const parts = val
		.split(',')
		.map(s => s.trim())
		.filter(Boolean)
	return [...prev, ...parts]
}

function parsePort(value: string): number {
	const port = Number(value)
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid port: ${value}`)
	}

	return port
}

function createCommanderOption(optionSpec: CliOptionSpec): Option {
	const option = new Option(optionSpec.flags, optionSpec.description)

	if (optionSpec.choices && optionSpec.choices.length > 0) {
		option.choices(optionSpec.choices)
	}

	if (optionSpec.parser === 'comma-separated') {
		option.argParser(handleCommaSeparatedList)
	}

	if (optionSpec.type === 'number') {
		option.argParser(parsePort)
	}

	return option
}

function registerArguments(command: Command, argumentSpecs?: CliArgumentSpec[]) {
	if (!argumentSpecs) {
		return
	}

	for (const argumentSpec of argumentSpecs) {
		const token = argumentSpec.required ? `<${argumentSpec.name}>` : `[${argumentSpec.name}]`
		command.argument(token, argumentSpec.description)
	}
}

// Registers a command and any nested subcommands. A command with `commands` is a
// group (e.g. `new`) that holds subcommands and has no action of its own; a leaf
// command (e.g. `new document`) gets its handler, keyed by its full path.
function registerCommand(
	parent: Command,
	commandSpec: CliCommandSpec,
	path: string[],
	handlers: Record<string, CommandHandler>
) {
	const command = parent.command(commandSpec.name).description(commandSpec.description)

	registerArguments(command, commandSpec.arguments)

	for (const optionSpec of commandSpec.options) {
		command.addOption(createCommanderOption(optionSpec))
	}

	const fullPath = [...path, commandSpec.name]

	if (commandSpec.commands && commandSpec.commands.length > 0) {
		for (const childSpec of commandSpec.commands) {
			registerCommand(command, childSpec, fullPath, handlers)
		}

		return
	}

	const key = fullPath.join(' ')
	const handler = handlers[key]

	if (!handler) {
		throw new Error(`Missing command handler for "${key}"`)
	}

	command.action(handler as Parameters<Command['action']>[0])
}

interface CreateSpecProgramArgs {
	name: string
	description: string
	spec: CliSpec
	handlers: Record<string, CommandHandler>
}

// The shared spec-driven commander setup. The `format-studio` program
// reuses it with its own spec and handlers.
export function createSpecProgram(args: CreateSpecProgramArgs): Command {
	const { name, description, spec, handlers } = args

	const program = new Command()
	program.name(name).description(description)

	for (const commandSpec of spec.commands) {
		registerCommand(program, commandSpec, [], handlers)
	}

	return program
}

export function createProgram(): Command {
	return createSpecProgram({
		name: 'format-compile',
		description: 'Format Compile',
		spec: cliSpecJson as CliSpec,
		handlers: {
			compile: async (options: CompileOptions): Promise<void> => {
				await compile(options)
			}
		}
	})
}
