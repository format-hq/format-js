import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/index.ts', 'src/mode.ts'],
	format: ['esm', 'cjs'],
	outDir: 'dist',
	platform: 'node',
	dts: {
		sourcemap: true
	},
	clean: true
})
