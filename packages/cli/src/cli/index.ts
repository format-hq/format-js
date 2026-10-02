import type { NewDocumentOptions } from './commands/new-document.ts'
import type { NewProjectOptions } from './commands/new-project.ts'
import type { InitOptions } from './commands/init.ts'

import { Command, Option } from 'commander'

import cliSpecJson from './cli-spec.json' with { type: 'json' }
import { addCommand } from './commands/add.ts'
import { initCommand } from './commands/init.ts'
import { newDocumentCommand } from './commands/new-document.ts'
import { removeCommand } from './commands/remove.ts'
import { newProjectCommand } from './commands/new-project.ts'
import { updateCommand } from './commands/update.ts'
import { versionCommand } from './commands/version.ts'
import { runStudioCommand } from '../studio.ts'

interface CliOptionSpec {
	field: string
	flags: string
	description: string
	type: string
	choices?: string[]
	defaultValue?: string | number | boolean | null
}

interface CliArgumentSpec {
	name: string
	description: string
	required?: boolean
}

interface CliCommandSpec {
	name: string
	description: string
	options: CliOptionSpec[]
	arguments?: CliArgumentSpec[]
	commands?: CliCommandSpec[]
}

interface CliSpec {
	commands: CliCommandSpec[]
}

type CommandHandler = (...args: any[]) => Promise<number>

// Commands forwarded verbatim to Studio at the pinned version. They live in
// Studio's own cli-spec (which documents them), so they aren't in ours.
const STUDIO_COMMANDS: { name: string; description: string }[] = [
	{ name: 'dev', description: 'Open Studio for this project.' },
	{ name: 'compile', description: "Compile this project's documents into a renderer." },
	{ name: 'clear-cache', description: "Clear Studio's local cache." }
]

function createCommanderOption(optionSpec: CliOptionSpec): Option {
	const option = new Option(optionSpec.flags, optionSpec.description)

	if (optionSpec.choices && optionSpec.choices.length > 0) {
		option.choices(optionSpec.choices)
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

// Registers a command and any nested subcommands. A command with `commands` is
// a group (e.g. `new`) that holds subcommands and has no action of its own; a
// leaf command gets its handler, keyed by its full path.
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

	command.action(async (...args) => {
		process.exitCode = await handler(...args)
	})
}

export function createProgram(): Command {
	const program = new Command()
	const cliSpec = cliSpecJson as CliSpec
	const cwd = process.cwd()

	program
		.name('format')
		.description(
			'The Format CLI: create projects and documents, run Studio, compile renderers, and keep every Format package on one release.'
		)
		.enablePositionalOptions()

	const handlers: Record<string, CommandHandler> = {
		'new project': (directory: string | undefined, options: NewProjectOptions) =>
			newProjectCommand(cwd, directory, options),
		'new document': (name: string | undefined, options: NewDocumentOptions) => newDocumentCommand(cwd, name, options),
		init: (options: InitOptions) => initCommand(cwd, options),
		add: (packages: string[]) => addCommand(cwd, packages),
		remove: (packages: string[]) => removeCommand(cwd, packages),
		update: (version: string | undefined) => updateCommand(cwd, version),
		version: () => versionCommand(cwd)
	}

	for (const commandSpec of cliSpec.commands) {
		registerCommand(program, commandSpec, [], handlers)
	}

	// Studio-owned commands pass everything through untouched — including
	// --help, which Studio answers itself.
	for (const { name, description } of STUDIO_COMMANDS) {
		program
			.command(name)
			.description(description)
			.helpOption(false)
			.allowUnknownOption()
			.passThroughOptions()
			.argument('[args...]')
			.action(async (_args: string[], _options: unknown, command: Command) => {
				process.exitCode = await runStudioCommand(cwd, [name, ...command.args])
			})
	}

	return program
}
