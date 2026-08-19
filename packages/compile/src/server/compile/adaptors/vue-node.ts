import type { CreateOptions, RenderOptions } from './types'
import { getNodeRequire, logRequireFailure } from './node-require'

let vue: any = null
let vsr: any = null
let _cwd: any = null
let _pending: Promise<{ vue: any; vsr: any }> | null = null

async function getVue(cwd?: string) {
	const resolutionContext = cwd || process.cwd()

	if (_cwd === resolutionContext && vue && vsr) {
		return { vue, vsr }
	}

	if (_cwd === resolutionContext && _pending) {
		return _pending
	}

	_cwd = resolutionContext
	const load = (async () => {
		const userRequire = await getNodeRequire(resolutionContext)

		try {
			vue = userRequire('vue')
			vsr = userRequire('vue/server-renderer')
		} catch (error) {
			logRequireFailure('vue', resolutionContext, error)
			throw error
		}

		return { vue, vsr }
	})()
	_pending = load

	try {
		return await load
	} finally {
		if (_pending === load) {
			_pending = null
		}
	}
}

export default {
	async create({ Component, data, cwd }: CreateOptions) {
		const { vue } = await getVue(cwd)
		return vue.createSSRApp(Component, { data })
	},
	async render({ element, cwd }: RenderOptions) {
		const { vsr } = await getVue(cwd)
		return vsr.renderToString(element)
	}
}
