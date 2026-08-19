import { compileState } from '../../runtime-state'
import { getStyleIdInfo } from './utils'

// This plugin constantly updates a map of all the CSS in the project
export function collectCssPlugin() {
	return {
		name: 'collect-css',
		transform(code: string, id: string) {
			const { isCssFile, isVueStyleRequest } = getStyleIdInfo(id, ['.css', '.scss', '.sass'])

			if (isCssFile || isVueStyleRequest) {
				compileState.getCss().set(id, code)
			}
		}
	}
}
