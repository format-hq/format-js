import type { FormatRegion } from './types'
import { version } from '../package.json'

export const REGION_MAP: Record<FormatRegion, string> = {
	GLOBAL: 'https://api.format.dev'
	// US: 'https://us.api.format.dev',
	// EU: 'https://eu.api.format.dev'
} as const

// API version prefix used by renderUrl() in helpers.ts. Keep it in sync with the API route.
export const API_PREFIX = '/v1'

export const CLIENT_IDENTIFIER = `@format.dev/client/${version}`

// Shared by the Node and web builds, so nothing here may read `process` or any
// other Node global. The Node build adds its own User-Agent in client.ts.
export const DEFAULTS = {
	baseUrl: REGION_MAP.GLOBAL
} as const
