import { defineConfig } from 'tsdown'
// .ts extension: build/release typechecks under NodeNext, which requires one
import { releaseDefines } from '../../build/release/constants.ts'

export default defineConfig({
	define: releaseDefines(),
	entry: 'src/index.ts',
	format: ['esm', 'cjs'],
	outDir: 'dist',
	platform: 'neutral',
	external: ['react', 'react-dom'],
	dts: {
		sourcemap: true
	},
	clean: true
})
