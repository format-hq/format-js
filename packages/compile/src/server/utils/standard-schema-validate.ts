import type { StandardSchemaV1 } from '@standard-schema/spec'

type Failure = { issues: ReadonlyArray<StandardSchemaV1.Issue> }
type Success<T> = { value: T }

function hasIssues(x: unknown): x is Failure {
	return typeof x === 'object' && x !== null && 'issues' in x
}

export async function validate<TSchema extends StandardSchemaV1>(
	schema: TSchema,
	input: unknown
): Promise<
	| { ok: true; data: StandardSchemaV1.InferOutput<TSchema> }
	| { ok: false; errors: ReadonlyArray<StandardSchemaV1.Issue> }
> {
	let result = schema['~standard'].validate(input)
	if (result instanceof Promise) result = await result

	if (hasIssues(result)) {
		return {
			ok: false,
			errors: result.issues ?? []
		}
	}

	return {
		ok: true,
		data: (result as Success<StandardSchemaV1.InferOutput<TSchema>>).value
	}
}

export default validate
