import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: 'src/index.ts',
	format: ['esm', 'cjs'],
	outDir: 'dist',
	platform: 'node', // TODO: add support for browser
	dts: {
		sourcemap: true
	},
	clean: true
})
