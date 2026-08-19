/**
 * JS-level API patches for the render worker subprocess.
 *
 * Applied in 'standard' sandbox mode (dev path) where Node's
 * --experimental-permission model can't be used because Vite's
 * plugin toolchain needs unrestricted filesystem and child_process
 * access (esbuild, Panda CSS, Tailwind, etc.).
 *
 * We patch outbound network APIs (fetch, http.request, https.request)
 * to block the primary exfiltration vector. Combined with the scrubbed
 * environment (env.ts), this means malicious template code can't read
 * secrets from process.env AND can't phone home with stolen data.
 *
 * What we intentionally do NOT patch:
 *   - child_process: esbuild spawns its own binary, Panda CSS uses it
 *   - net.Socket / net.connect: esbuild uses local sockets for IPC
 *   - http.createServer: Vite creates an internal WebSocket server
 *   - fs: Vite plugins need broad filesystem access
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const SANDBOX_ERROR_CODE = 'ERR_SANDBOX_RESTRICTION'

function blocked(api: string): never {
	const error = new Error(
		`The ${api} API is disabled in document template code. ` + 'Template code cannot make network requests.'
	)
	error.name = SANDBOX_ERROR_CODE
	;(error as any).code = SANDBOX_ERROR_CODE
	throw error
}

function patchFetch() {
	globalThis.fetch = function fetch(): never {
		blocked('fetch')
	}

	if (typeof globalThis.WebSocket !== 'undefined') {
		globalThis.WebSocket = class WebSocket {
			constructor() {
				blocked('WebSocket')
			}
		} as unknown as typeof globalThis.WebSocket
	}
}

function patchOutboundHttp() {
	const http = require('node:http')
	http.request = () => blocked('http.request')
	http.get = () => blocked('http.get')

	const https = require('node:https')
	https.request = () => blocked('https.request')
	https.get = () => blocked('https.get')

	const tls = require('node:tls')
	tls.connect = () => blocked('tls.connect')

	const dgram = require('node:dgram')
	dgram.createSocket = () => blocked('dgram.createSocket')
}

export function applySandboxPatches() {
	patchFetch()
	patchOutboundHttp()
}
