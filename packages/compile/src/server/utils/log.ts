import { LogLevel } from '../../shared/types'

export const logPrefix = '[format:studio]'

// ANSI escape sequences
const COLORS = Object.freeze({
	reset: '\u001b[0m',
	red: '\u001b[31m',
	green: '\u001b[32m',
	yellow: '\u001b[33m',
	blue: '\u001b[34m',
	magenta: '\u001b[35m',
	cyan: '\u001b[36m',
	gray: '\u001b[90m'
})

const LEVEL_COLORS = Object.freeze({
	error: COLORS.red,
	warn: COLORS.yellow,
	info: COLORS.cyan,
	log: COLORS.green,
	debug: COLORS.magenta
})

let currentLogLevel = LogLevel.INFO
let logFilter: ((level: keyof typeof LEVEL_COLORS, ...args: any[]) => boolean) | null = null

export const setLogLevel = (level: LogLevel) => {
	currentLogLevel = level
}

export const defaultLogLevel = LogLevel.INFO

export const getLogLevel = () => currentLogLevel

export const setLogFilter = (fn: ((level: keyof typeof LEVEL_COLORS, ...args: any[]) => boolean) | null) => {
	logFilter = fn
}

const shouldLog = (level: LogLevel, name: keyof typeof LEVEL_COLORS, ...args: any[]) =>
	level <= currentLogLevel && (!logFilter || logFilter(name, ...args))

function formatTimestamp(): string {
	const now = new Date()
	// e.g. "2025-09-03 20:15:43"
	return now.toISOString().replace('T', ' ').replace(/\..+/, '')
}

const colorize = (level: keyof typeof LEVEL_COLORS) => {
	const ts = formatTimestamp()
	return `${COLORS.gray}[${ts}]${COLORS.reset} ${LEVEL_COLORS[level]}${logPrefix}${COLORS.reset}`
}

// Capture the real console once so logger never recurses
const originalConsole = {
	log: console.log,
	info: console.info,
	warn: console.warn,
	error: console.error,
	debug: console.debug,
	clear: console.clear
}

const timers = new Map<string, number>()

function startTimer(label: string) {
	timers.set(label, performance.now())
}

function endTimer(label: string): string | null {
	const start = timers.get(label)
	if (start == null) {
		return null
	}
	const duration = performance.now() - start
	timers.delete(label)
	return `${label}: ${duration.toFixed(2)}ms`
}

export const logger = {
	clear: () => {
		originalConsole.clear()
	},
	error: (...args: any[]) => {
		if (shouldLog(LogLevel.ERROR, 'error', ...args)) {
			originalConsole.error(colorize('error'), ...args)
		}
	},
	warn: (...args: any[]) => {
		if (shouldLog(LogLevel.WARN, 'warn', ...args)) {
			originalConsole.warn(colorize('warn'), ...args)
		}
	},
	log: (...args: any[]) => {
		if (shouldLog(LogLevel.INFO, 'log', ...args)) {
			originalConsole.log(colorize('log'), ...args)
		}
	},
	info: (...args: any[]) => {
		if (shouldLog(LogLevel.INFO, 'info', ...args)) {
			originalConsole.info(colorize('info'), ...args)
		}
	},
	time: (label: string) => {
		if (shouldLog(LogLevel.INFO, 'info', label)) {
			startTimer(label)
		}
	},
	timeEnd: (label: string) => {
		if (shouldLog(LogLevel.INFO, 'info', label)) {
			const result = endTimer(label)
			if (result) {
				originalConsole.info(colorize('info'), result)
			} else {
				originalConsole.warn(colorize('warn'), `No such label: ${label}`)
			}
		}
	},
	debug: (...args: any[]) => {
		if (shouldLog(LogLevel.DEBUG, 'debug', ...args)) {
			originalConsole.debug(colorize('debug'), ...args)
		}
	}
}

/**
 * Temporarily override the console methods with the logger methods.
 * Helpful when we don't have control of a logger instance inside another package.
 *
 * @param run - The async or sync function to run with the prefixed console
 * @param filter - Optional filter function (return false to suppress a log)
 */
export async function withPrefixedConsole(
	run: () => Promise<any> | any,
	filter?: (level: keyof typeof LEVEL_COLORS, ...args: any[]) => boolean
) {
	const { log, info, warn, error, debug, clear, time, timeEnd } = console
	const previousFilter = logFilter

	if (filter) {
		setLogFilter(filter)
	}

	console.log = logger.log
	console.info = logger.info
	console.warn = logger.warn
	console.error = logger.error
	console.debug = logger.debug
	console.clear = logger.clear
	console.time = logger.time
	console.timeEnd = logger.timeEnd

	try {
		return await run()
	} finally {
		console.log = log
		console.info = info
		console.warn = warn
		console.error = error
		console.debug = debug
		console.clear = clear
		console.time = time
		console.timeEnd = timeEnd

		// restore previous filter
		setLogFilter(previousFilter)
	}
}
