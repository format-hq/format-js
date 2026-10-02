import type { UserConfig } from 'tsdown'
// .ts extension: build/release typechecks under NodeNext, which requires one
import { releaseDefines } from '../../build/release/constants.ts'

// 'dev' scaffolds projects with workspace:* deps (installable only inside this
// repo); 'prod' — the published build — pins @format.dev/* deps to the CLI's own
// lockstep version and stamps format.config.json.
type BuildMode = 'dev' | 'prod'

export function makeConfig(buildMode: BuildMode): UserConfig {
	return {
		// Object form pins each output name: bin/format.mjs imports dist/index.mjs and
		// the subpath exports keep their flat dist paths across folder moves.
		entry: {
			index: 'src/cli/bin.ts',
			config: 'src/config.ts',
			scaffold: 'src/scaffold/index.ts',
			'scaffold-shared': 'src/scaffold/shared.ts',
			'random-name': 'src/scaffold/document/draw-random-name.ts',
			lockstep: 'src/versioning/lockstep.ts'
		},
		format: ['esm'],
		clean: true,
		dts: true,
		define: releaseDefines(),
		env: {
			FORMAT_CLI_MODE: buildMode
		}
	}
}
