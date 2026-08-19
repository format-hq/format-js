import { FormatRegion } from './types'
import { version } from '../package.json'

export const REGION_MAP: Record<FormatRegion, string> = {
	GLOBAL: 'https://api.format.dev'
	// US: 'https://us.api.format.dev',
	// EU: 'https://eu.api.format.dev'
} as const

// API version segment. The base URLs above are clean hosts; the version lives in the
// request path (see client.ts), so a version bump is one edit here plus press's route.
export const API_PREFIX = '/v1'

export const CLIENT_IDENTIFIER = `@format.dev/client/${version}`

export const DEFAULTS = {
	baseUrl: REGION_MAP.GLOBAL,
	userAgent: `${CLIENT_IDENTIFIER} (${process.platform}) node ${process.version}`
} as const
