import { CliError } from '../errors.ts'

// All public Format packages release in lockstep, so any one package's latest
// version is the latest Format release. Studio is used as the reference.
const REFERENCE_PACKAGE = '@format.dev/studio'

// Honour npm's registry configuration (a project .npmrc or the
// npm_config_registry env var), falling back to the public registry — so
// private registries and test registries resolve `latest` consistently with
// where installs actually come from.
function registryBaseUrl(): string {
	const configured = process.env.npm_config_registry

	return (configured || 'https://registry.npmjs.org').replace(/\/$/, '')
}

export async function fetchLatestVersion(): Promise<string> {
	const url = `${registryBaseUrl()}/${encodeURIComponent(REFERENCE_PACKAGE)}/latest`

	let response: Response

	try {
		response = await fetch(url, { headers: { accept: 'application/json' } })
	} catch {
		throw new CliError('Could not reach the npm registry. Check your connection and try again.')
	}

	if (!response.ok) {
		throw new CliError(`npm registry request failed (${response.status}) while resolving the latest Format version.`)
	}

	const data = (await response.json()) as { version?: string }

	if (!data.version) {
		throw new CliError('Unexpected npm registry response while resolving the latest Format version.')
	}

	return data.version
}
