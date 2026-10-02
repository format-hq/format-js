import { defineConfig } from 'vitest/config'

// Plain Node tests for plain functions: this package is `platform: 'neutral'`
// and depends on nothing, so its tests need no environment, no setup and no
// browser. Run from the press unit job rather than a runner of their own —
// `packages/utils/**` already routes there.
export default defineConfig({
	test: {
		name: 'utils',
		include: ['test/**/*.test.ts'],
		environment: 'node'
	}
})
