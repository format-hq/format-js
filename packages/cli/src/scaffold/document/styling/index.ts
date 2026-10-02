import type { Framework } from '../../shared.ts'
import type { StylingMethod, StylingStrategy } from '../types.ts'

import { CliError } from '../../../errors.ts'
import { STYLING_SUPPORT, methodsForFramework, isStylingMethod } from '../../shared.ts'
import { STYLING_STRATEGIES } from './strategies.ts'

export { STYLING_STRATEGIES, methodsForFramework, isStylingMethod }

interface ResolveStylingArgs {
	framework: Framework
	method: StylingMethod
}

export function resolveStyling(args: ResolveStylingArgs): StylingStrategy {
	const { framework, method } = args

	const strategy = STYLING_STRATEGIES.find(candidate => candidate.method === method)

	if (!strategy) {
		const available = STYLING_STRATEGIES.map(candidate => candidate.method).join(', ')
		throw new CliError(`Unknown styling method "${method}". Available methods: ${available}.`)
	}

	if (!STYLING_SUPPORT[method].includes(framework)) {
		const supported = methodsForFramework(framework).join(', ')
		throw new CliError(
			`The "${method}" styling method isn't supported for ${framework} projects. Supported methods: ${supported}.`
		)
	}

	return strategy
}
