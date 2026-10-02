import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: './src/**/*.ts',
	format: 'esm',
	outDir: 'dist',
	platform: 'neutral',
	dts: {
		sourcemap: true
	},
	clean: true,
	unbundle: true
})
