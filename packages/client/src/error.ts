/**
 * Thrown when the Format API returns a non-2xx response. Contains the HTTP status code and parsed error body.
 */
export class FormatError extends Error {
	constructor(
		/** HTTP status code from the API response. */
		public status: number,
		/** Parsed error response body. Typically a JSON object with error details, or `{ raw: string }` if the body couldn't be parsed. */
		public detail: unknown
	) {
		super(`Format API: Error ${status}`)
	}
}
