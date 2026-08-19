import type { CreateOptions, RenderOptions } from './types'

import react from 'react'
import rds from 'react-dom/server'

export default {
	create({ Component, data }: CreateOptions) {
		return react.createElement(Component, { data })
	},
	render({ element }: RenderOptions) {
		return Promise.resolve(rds.renderToString(element))
	}
}
