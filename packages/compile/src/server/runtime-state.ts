import type { CssConcat } from '../shared/types'
import type { FormatConfig } from '../shared/types/public/config'

import { CompileError } from './errors'
import { NO_CONFIG_FILE_MESSAGE } from './constants'

interface RuntimeState {
	config: FormatConfig | null
	css: CssConcat
}

const runtimeState: RuntimeState = {
	config: null,
	css: new Map()
}

export const compileState = {
	getConfig(): FormatConfig {
		if (!runtimeState.config) {
			throw new CompileError(NO_CONFIG_FILE_MESSAGE)
		}
		return runtimeState.config
	},

	setConfig(config: FormatConfig) {
		runtimeState.config = config
	},

	getCss(): CssConcat {
		return runtimeState.css
	}
}
