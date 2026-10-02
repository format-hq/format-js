import type { StandardSchemaV1 } from '@standard-schema/spec'

declare module 'virtual:schema' {
	const schema: StandardSchemaV1 | undefined
	export default schema
}

declare module 'virtual:validate' {
	async function validate<TSchema extends StandardSchemaV1>(
		schema: TSchema,
		input: unknown
	): Promise<
		| { ok: true; data: StandardSchemaV1.InferOutput<TSchema> }
		| { ok: false; errors: ReadonlyArray<StandardSchemaV1.Issue> }
	>
	export default validate
}

declare module 'virtual:adaptor' {
	export interface Adaptor {
		create(options: { Component: any; data: Record<string, any>; cwd?: string }): Promise<any>
		render(options: { element: any; engine?: string; cwd?: string }): Promise<string>
	}

	const adaptor: Adaptor
	export default adaptor
}
