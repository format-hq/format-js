import { defineConfig } from 'tsdown'

export default defineConfig([
	// The Node build. It streams multipart bodies through Node streams and can
	// write a PDF to disk.
	{
		entry: 'src/index.ts',
		format: ['esm', 'cjs'],
		outDir: 'dist',
		platform: 'node',
		dts: {
			sourcemap: true
		},
		clean: true
	},
	// The web build uses native FormData and fetch, with no Node imports.
	// Bundlers select it through the `browser` export condition.
	{
		entry: 'src/web.ts',
		format: ['esm', 'cjs'],
		outDir: 'dist',
		platform: 'browser',
		fixedExtension: true,
		dts: {
			sourcemap: true
		},
		clean: false
	}
])
