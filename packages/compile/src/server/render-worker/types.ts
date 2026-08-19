export interface SerializedError {
	name: string
	message: string
	stack?: string
	code?: string
	data?: unknown
	/** Asset paths an AssetMismatchError carries, kept so consumers can rebuild a friendly message. */
	missing?: string[]
	known?: string[]
	/** Remote URLs the rendered HTML references, so the compile can probe them after a local-asset failure. */
	remoteRefs?: string[]
}

export interface CompileRenderRequest {
	id: string
	type: 'compile-render'
	bundlePath: string
	documentName: string
	data: unknown
	cwd: string
}

export interface DevInitRequest {
	id: string
	type: 'dev-init'
	root: string
	framework: 'react' | 'vue' | 'html'
	configJson: string
	decodeStyleEntities?: boolean
}

export interface DevRenderRequest {
	id: string
	type: 'dev-render'
	entryFilePath: string
	data: unknown
	framework: 'react' | 'vue' | 'html'
	engineVersion: string
}

export interface RenderResult {
	id: string
	type: 'render-result'
	html: string
}

export interface RenderErrorResponse {
	id: string
	type: 'render-error'
	error: SerializedError
}

export interface WorkerReady {
	type: 'ready'
}

export interface DevInitResult {
	id: string
	type: 'dev-init-result'
}

export type WorkerRequest = CompileRenderRequest | DevRenderRequest | DevInitRequest
export type WorkerResponse = RenderResult | RenderErrorResponse | WorkerReady | DevInitResult
