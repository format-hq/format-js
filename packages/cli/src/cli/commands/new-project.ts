import type { Framework } from '../../scaffold/shared.ts'

import pc from 'picocolors'

import { intro, outro, text, select, confirm, log, spinner } from '@clack/prompts'

import { CliError } from '../../errors.ts'
import { detectPackageManager, installCommand } from '../../package-manager.ts'
import { requirePrompt, isPromptCancelledError } from '../../prompts.ts'
import { SUPPORTED_FRAMEWORKS } from '../../scaffold/shared.ts'

import { scaffoldProject, installProjectDependencies, templateUsesWorkspaceDeps } from '../../scaffold/project.ts'
import { truncateForSpinner } from '../../scaffold/run-install.ts'

export interface NewProjectOptions {
	directory?: string
	framework?: string
	install?: boolean
	yes?: boolean
}

function isFramework(value: string): value is Framework {
	return (SUPPORTED_FRAMEWORKS as readonly string[]).includes(value)
}

async function resolveDirectory(provided: string | undefined, skipPrompts: boolean): Promise<string> {
	if (provided) {
		return provided
	}

	if (skipPrompts) {
		return './my-format-project'
	}

	return requirePrompt(
		await text({
			message: 'Where should we create your project?',
			placeholder: './my-format-project',
			defaultValue: './my-format-project'
		})
	)
}

async function resolveFramework(provided: string | undefined, skipPrompts: boolean): Promise<Framework> {
	if (provided !== undefined) {
		if (!isFramework(provided)) {
			throw new CliError(`Invalid --framework: "${provided}". Choices: ${SUPPORTED_FRAMEWORKS.join(', ')}.`)
		}

		return provided
	}

	if (skipPrompts) {
		return 'react'
	}

	return requirePrompt(
		await select<Framework>({
			message: 'How do you want to build your PDFs?',
			options: [
				{ value: 'html', label: 'HTML' },
				{ value: 'react', label: 'React' },
				{ value: 'vue', label: 'Vue' }
			],
			initialValue: 'react'
		})
	)
}

async function resolveInstall(provided: boolean | undefined, skipPrompts: boolean): Promise<boolean> {
	if (provided !== undefined) {
		return provided
	}

	if (skipPrompts) {
		return true
	}

	return requirePrompt(await confirm({ message: 'Automatically install dependencies?', initialValue: true }))
}

function runDevLine(packageManager: string): string {
	return packageManager === 'npm' ? 'npm run dev' : `${packageManager} dev`
}

export async function newProjectCommand(
	cwd: string,
	providedDirectory: string | undefined,
	options: NewProjectOptions
): Promise<number> {
	const skipPrompts = options.yes === true

	intro(pc.bgCyan(pc.black(' Format ')))

	try {
		const directory = await resolveDirectory(providedDirectory, skipPrompts)
		const framework = await resolveFramework(options.framework, skipPrompts)
		const wantInstall = await resolveInstall(options.install, skipPrompts)

		const scaffold = spinner()
		scaffold.start('Creating project')
		const { dirPath } = await scaffoldProject({ directory, framework, cwd })
		scaffold.stop(`Created a ${pc.cyan(framework)} project in ${pc.cyan(directory)}`)

		let packageManager = await detectPackageManager(cwd)
		let needsInstall = !wantInstall

		if (wantInstall) {
			const install = spinner()
			install.start(`Installing dependencies with ${packageManager}`)

			const result = await installProjectDependencies({
				dirPath,
				preferredPackageManager: packageManager,
				onProgress: line => install.message(truncateForSpinner(line))
			})

			if (result.ok) {
				packageManager = result.packageManagerUsed
				needsInstall = false

				install.stop(`Dependencies installed with ${pc.cyan(packageManager)}`)

				if (result.fellBackToNpm) {
					log.warn('Could not find your package manager. Fell back to npm.')
				}
			}

			if (!result.ok) {
				needsInstall = true

				install.error(`Could not install dependencies with ${packageManager}`)

				log.error(result.message ?? 'unknown error')

				if (result.output) {
					log.message(pc.dim(result.output))
				}

				if (await templateUsesWorkspaceDeps(dirPath)) {
					log.warn('This template uses `workspace:*` deps, which only install inside a workspace.')
				}
			}
		}

		const steps = [`cd ${directory}`]

		if (needsInstall) {
			const { command, args } = installCommand(packageManager)
			steps.push(`${command} ${args.join(' ')}`)
		}

		steps.push(runDevLine(packageManager))

		outro(`Start Studio with ${pc.cyan(steps.join(' && '))}`)

		return 0
	} catch (error) {
		if (isPromptCancelledError(error)) {
			return 0
		}

		throw error
	}
}
