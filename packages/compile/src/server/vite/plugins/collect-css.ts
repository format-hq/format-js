import { compileState } from '../../runtime-state'
import { getStyleIdInfo } from './utils'

// Keep each style module's CSS from its latest transform. A render reads the
// entries its document imports, because Vite skips the transform for modules
// it has already loaded.
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
