import { defineConfig } from 'tsdown'

// ESM only. A CommonJS consumer of @format.dev/zip reaches this package through
// require(), which works because zip's floor is Node >=22.12.0 and that whole
// range loads ESM through require(). The floor can't drop below 22.12 while
// the platform ships ESM only: 21.x and 22.0–22.11 throw ERR_REQUIRE_ESM
// (version order doesn't order the feature — Node added default require(esm)
// separately in 20.19, 22.12, 23.0).
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
