import type { CreateOptions, RenderOptions } from './types'
import { getNodeRequire, logRequireFailure } from './node-require'

let react: any = null
let rds: any = null
let _cwd: any = null
let _pending: Promise<{ react: any; rds: any }> | null = null

async function getReact(cwd?: string) {
	const resolutionContext = cwd || process.cwd()

	if (_cwd === resolutionContext && react && rds) {
		return { react, rds }
	}

	if (_cwd === resolutionContext && _pending) {
		return _pending
	}

	_cwd = resolutionContext
	const load = (async () => {
		const userRequire = await getNodeRequire(resolutionContext)

		try {
			react = userRequire('react')
			rds = userRequire('react-dom/server')
		} catch (error) {
			logRequireFailure('react', resolutionContext, error)
			throw error
		}

		return { react, rds }
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
		const { react } = await getReact(cwd)
		return react.createElement(Component, { data })
	},
	async render({ element, cwd }: RenderOptions) {
		const { rds } = await getReact(cwd)
		return Promise.resolve(rds.renderToString(element))
	}
}
