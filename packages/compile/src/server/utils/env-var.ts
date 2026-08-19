import { LogLevel } from '../../shared/types'
import { defaultLogLevel } from './log'

export function parseEnvVarAsBool(value: string) {
	if (typeof value !== 'string') {
		return false
	}

	switch (value.trim().toLowerCase()) {
		case 'true':
		case '1':
			return true
		case 'false':
		case '0':
			return false
		default:
			return false
	}
}

export function parseLogLevelFromEnv(): number {
	const debugEnv = process.env.FORMAT_DEBUG
	const logLevelEnv = process.env.FORMAT_LOG_LEVEL

	if (debugEnv && parseEnvVarAsBool(debugEnv)) {
		return LogLevel.DEBUG
	}

	if (!logLevelEnv) {
		return defaultLogLevel
	}

	const level = parseInt(logLevelEnv, 10)

	if (!level || isNaN(level)) {
		return LogLevel.WARN
	}

	if (level >= LogLevel.ERROR && level <= LogLevel.DEBUG) {
		return level
	}

	return defaultLogLevel
}
