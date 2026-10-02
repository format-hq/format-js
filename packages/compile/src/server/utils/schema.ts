import { resolvePathWithExtensions } from './resolve-path-with-extensions'
import { DEFAULT_SCHEMA_FILE_NAME } from '../constants'

export { default as validate } from './standard-schema-validate'

export async function getSchemaPath(dataDir: string): Promise<string | null> {
	const fileName = process.env.FMT_SCHEMA_FILE_NAME || DEFAULT_SCHEMA_FILE_NAME

	try {
		const result = await resolvePathWithExtensions({
			path: dataDir,
			fileName,
			extensions: ['.ts', '.js']
		})

		return result
	} catch (error) {
		return null
	}
}
