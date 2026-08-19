const debug = process.env.FORMAT_DEBUG === '1' || process.env.FORMAT_DEBUG === 'true'

const prefix = '[format:bundle]'

function logDebug(message: string, details?: unknown) {
	if (debug) {
		console.log(`${prefix}: Require ${message}`, details ?? '')
	}
}

export async function getNodeRequire(resolutionContext: string): Promise<NodeRequire> {
	const nonWebpackRequire = (globalThis as any).__non_webpack_require__

	if (typeof nonWebpackRequire === 'function') {
		logDebug(`${prefix}: Using '__non_webpack_require__'`, resolutionContext)
		return nonWebpackRequire
	}

	const globalRequire = (globalThis as any).require

	if (typeof globalRequire === 'function') {
		logDebug(`${prefix}: Using global require`, resolutionContext)
		return globalRequire
	}

	const { createRequire } = await import(/* webpackIgnore: true */ 'node:module')
	const userRequire = createRequire(resolutionContext + '/package.json')

	logDebug(`${prefix}: Using 'createRequire'`, resolutionContext)

	return userRequire
}

export function logRequireFailure(label: string, resolutionContext: string, error: unknown) {
	if (debug) {
		console.log(`${prefix}: Failed to require ${label}`, { resolutionContext, error })
	}
}
