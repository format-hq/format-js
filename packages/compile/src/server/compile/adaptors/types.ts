export type RenderOptions = {
	element: any
	engine?: string
	cwd?: string
}

export type CreateOptions = {
	Component: any
	data: Record<string, unknown>
	cwd?: string
}
