/**
 * Regional API endpoint. Controls which data center handles your render requests.
 *
 * - `GLOBAL` — Default. Routes to the nearest available region.
 * - `US` — Routes to the US data center.
 * - `EU` — Routes to the EU data center.
 *
 * @default 'GLOBAL'
 */
export type FormatRegion = 'GLOBAL' // | 'US' | 'EU'

/**
 * Accepted asset input types. The client normalizes all of these into a multipart form upload.
 *
 * - `Blob` — Web API Blob
 * - `Uint8Array` or `ArrayBuffer` — Raw binary data
 * - `ReadableStream<Uint8Array>` — Web ReadableStream (e.g. from `getAssetsWebStream()`)
 */
export type AssetLike = Blob | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>

/**
 * Options for creating a FormatClient instance.
 */
export type FormatOptions = {
	/**
	 * Your Format API key. If not provided, the Node client reads the `FORMAT_API_KEY` environment variable. Required by the web client.
	 */
	apiKey?: string

	/**
	 * Override the base API URL. If not provided, defaults to the URL for the selected `region`, or the global endpoint.
	 * @internal
	 * @example 'https://api.format.dev'
	 */
	baseUrl?: string

	/**
	 * Maximum time in milliseconds allowed for the render to complete. Prevents long-running renders from hanging indefinitely.
	 * @default 120000
	 */
	renderTimeoutMs?: number

	/**
	 * Region to route API requests to. Overrides the default global endpoint.
	 * @internal
	 * @default 'GLOBAL'
	 */
	region?: FormatRegion
}

export type { FormatDocument } from '@format.dev/types'

/**
 * Options for the `pdf()` method. All fields are optional.
 */
export type FormatPdfOptions = {
	/**
	 * Override the document's assets stream. Use this when you build the assets zip at runtime
	 * instead of relying on the compile-time output.
	 */
	assets?: AssetLike

	/**
	 * Metadata tags attached to this render. Useful for filtering and analytics in the Format dashboard. Duplicate and empty tags are removed automatically.
	 * @example ['invoice', 'customer-123']
	 */
	tags?: string[]

	/**
	 * Abort signal to cancel the request. Combined with the client's `renderTimeoutMs` — whichever fires first wins.
	 */
	signal?: AbortSignal
}

/**
 * Extended `Response` returned by `FormatClient.pdf()`, with metadata extracted from response headers.
 */
export type FormatResponse = Response & {
	/**
	 * Suggested filename from the `Content-Disposition` header, if present.
	 * @example 'document.pdf'
	 */
	filename?: string

	/**
	 * Size of the PDF in bytes, from the `Content-Length` header. Only present on successful PDF responses.
	 */
	contentLength?: number

	/**
	 * MIME type of the response. `application/pdf` for successful renders, `application/json` for errors.
	 */
	contentType?: string

	/**
	 * Traceparent ID for distributed tracing, if returned by the API. Useful for correlating client and server logs.
	 */
	traceparent?: string

	/**
	 * Whether the response is a PDF. Derived from `contentType === 'application/pdf'`.
	 */
	isPdf: boolean
}
