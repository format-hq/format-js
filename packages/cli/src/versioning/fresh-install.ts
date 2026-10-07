import fs from 'node:fs/promises'

const FORMAT_SCOPE = '@format.dev/'
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const

type Manifest = Partial<Record<(typeof DEPENDENCY_SECTIONS)[number], Record<string, string>>> & Record<string, unknown>

// The manifest without its @format.dev/* entries. Workspace links stay, since
// they point at local packages rather than anything the registry resolves.
export function withoutFormatDependencies(manifest: Manifest): Manifest {
	const copy: Manifest = { ...manifest }

	for (const section of DEPENDENCY_SECTIONS) {
		const entries = manifest[section]

		if (!entries) {
			continue
		}

		copy[section] = Object.fromEntries(
			Object.entries(entries).filter(
				([name, version]) => !name.startsWith(FORMAT_SCOPE) || version.startsWith('workspace:')
			)
		)
	}

	return copy
}

interface InstallWithFreshFormatTreeArgs {
	packageJsonPath: string
	install: () => Promise<void>
}

// Package managers keep any locked version that still satisfies a range, so an
// upgrade leaves behind dependencies a Format package changed or dropped. The
// first install runs without the Format packages, which drops everything only
// they used. The second installs them at the target, resolving their tree fresh
// as in a new project. The user's own dependencies keep their versions.
//
// This uses only `install`, so it works the same under npm, pnpm, yarn, and bun
// without reading any lockfile format.
export async function installWithFreshFormatTree(args: InstallWithFreshFormatTreeArgs): Promise<void> {
	const { packageJsonPath, install } = args

	const targetSource = await fs.readFile(packageJsonPath, 'utf8')
	const withoutFormat = withoutFormatDependencies(JSON.parse(targetSource) as Manifest)

	try {
		await fs.writeFile(packageJsonPath, `${JSON.stringify(withoutFormat, null, '\t')}\n`, 'utf8')
		await install()
	} finally {
		await fs.writeFile(packageJsonPath, targetSource, 'utf8')
	}

	await install()
}
