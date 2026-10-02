import { defineConfig } from 'tsdown'
import Vue from 'unplugin-vue/rolldown'
// .ts extension: build/release typechecks under NodeNext, which requires one
import { releaseDefines } from '../../build/release/constants.ts'

export default defineConfig({
	define: releaseDefines(),
	entry: ['./src/index.ts'],
	format: ['esm', 'cjs'],
	platform: 'neutral',
	plugins: [Vue({ isProduction: true })],
	external: ['vue'],
	dts: { sourcemap: true, vue: true }
})
