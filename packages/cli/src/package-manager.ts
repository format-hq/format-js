import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm'

const LOCKFILES: [string, PackageManager][] = [
	['pnpm-lock.yaml', 'pnpm'],
	['yarn.lock', 'yarn'],
	['bun.lock', 'bun'],
	['bun.lockb', 'bun'],
	['package-lock.json', 'npm']
]

// Walk up from startDir so a monorepo's root lockfile is found from a package.
function findLockfileManager(startDir: string): PackageManager | null {
	let dir = resolve(startDir)

	for (;;) {
		const match = LOCKFILES.find(([lockfile]) => existsSync(join(dir, lockfile)))

		if (match) {
			return match[1]
		}

		const parent = dirname(dir)

		if (parent === dir) {
			return null
		}

		dir = parent
	}
}

// The packageManager field (corepack) is the deliberate signal, so it wins; the
// npm_config_user_agent env var (set when the CLI itself runs under a package
// manager) is next, and lockfiles are the fallback.
export async function detectPackageManager(projectDir: string): Promise<PackageManager> {
	const packageJsonPath = join(projectDir, 'package.json')

	if (existsSync(packageJsonPath)) {
		const raw = await fs.readFile(packageJsonPath, 'utf8')
		const packageJson = JSON.parse(raw) as { packageManager?: string }
		const declared = packageJson.packageManager?.split('@')[0]

		if (declared === 'pnpm' || declared === 'yarn' || declared === 'bun' || declared === 'npm') {
			return declared
		}
	}

	const userAgent = process.env.npm_config_user_agent ?? ''
	const fromUserAgent = (['pnpm', 'yarn', 'bun'] as const).find(name => userAgent.includes(`${name}/`))

	if (fromUserAgent) {
		return fromUserAgent
	}

	return findLockfileManager(projectDir) ?? 'npm'
}

export function installCommand(packageManager: PackageManager): { command: string; args: string[] } {
	if (packageManager === 'npm') {
		return { command: 'npm', args: ['install'] }
	}

	// The CLI's installs (update, add, scaffold) deliberately change or add
	// dependencies, so the lockfile must be allowed to update. pnpm and yarn
	// default to a frozen/immutable lockfile under CI (CI=true) and would
	// otherwise refuse the very change the command is making.
	if (packageManager === 'pnpm') {
		return { command: 'pnpm', args: ['install', '--no-frozen-lockfile'] }
	}

	if (packageManager === 'yarn') {
		return { command: 'yarn', args: ['install', '--no-immutable'] }
	}

	return { command: packageManager, args: ['install'] }
}

// Windows resolves npm/pnpm/yarn through their .cmd shims; shell:false won't find
// the bare name there.
export function commandForPlatform(command: string): string {
	if (process.platform !== 'win32') {
		return command
	}

	if (command === 'npm' || command === 'pnpm' || command === 'yarn') {
		return `${command}.cmd`
	}

	return command
}
