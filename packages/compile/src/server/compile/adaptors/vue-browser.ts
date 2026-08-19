import type { CreateOptions, RenderOptions } from './types'

import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

export default {
	create({ Component, data }: CreateOptions) {
		return createSSRApp(Component, { data })
	},
	render({ element }: RenderOptions) {
		return renderToString(element)
	}
}
