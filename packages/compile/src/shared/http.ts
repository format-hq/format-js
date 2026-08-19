interface HttpOptions extends Omit<RequestInit, 'body' | 'headers'> {
	body?: unknown
	headers?: Record<string, string>
	responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer'
}

interface HttpResult<T = unknown> {
	data: T | null
	// A display-ready message. Every consumer treats a failed request's error as a
	// string (setError, new Error), so the payload is normalized here, not caller-side.
	error: string | null
	// The HTTP status, or null when the request never reached a response (fetch
	// threw — DNS/connection refused/offline). Callers that must tell "server
	// unreachable" from "server rejected us" branch on this.
	status: number | null
}

function toErrorMessage(payload: unknown): string {
	if (typeof payload === 'string') {
		return payload
	}

	if (payload && typeof payload === 'object') {
		const record = payload as Record<string, unknown>

		if (typeof record.error === 'string') {
			return record.error
		}

		if (typeof record.message === 'string') {
			return record.message
		}
	}

	return 'Request failed'
}

async function handleResponse<T>(
	response: Response,
	responseType: 'json' | 'text' | 'blob' | 'arrayBuffer'
): Promise<T> {
	if (responseType === 'text') {
		return (await response.text()) as T
	}

	if (responseType === 'blob') {
		return (await response.blob()) as T
	}

	if (responseType === 'arrayBuffer') {
		return (await response.arrayBuffer()) as T
	}

	return (await response.json()) as T
}

async function getErrorMessage(response: Response): Promise<string> {
	try {
		const errorData = await response.json()
		return toErrorMessage(errorData)
	} catch {
		// Body wasn't JSON — fall back to the status line.
	}

	return `${response.status} ${response.statusText}`.trim()
}

export async function http<T = unknown>(url: string, options: HttpOptions = {}): Promise<HttpResult<T>> {
	const { body, headers = {}, responseType = 'json', ...restOptions } = options

	const requestHeaders: Record<string, string> = { ...headers }

	if (body !== undefined) {
		requestHeaders['Content-Type'] = 'application/json'
	}

	try {
		const response = await fetch(url, {
			...restOptions,
			headers: requestHeaders,
			body: body !== undefined ? JSON.stringify(body) : undefined
		})

		if (!response.ok) {
			return { data: null, error: await getErrorMessage(response), status: response.status }
		}

		const data = await handleResponse<T>(response, responseType)
		return { data, error: null, status: response.status }
	} catch (err) {
		return { data: null, error: err instanceof Error ? err.message : toErrorMessage(err), status: null }
	}
}
