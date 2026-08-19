import { defineConfig } from 'vitest/config'
// .ts extension: build/release typechecks under NodeNext, which requires one
import { releaseDefines } from '../../build/release/constants.ts'

export default defineConfig({
	test: {
		projects: [
			{
				// A suite importing source needs the same substitution the published
				// build performs. There is no runtime default: a build that failed to
				// substitute must fail rather than ship a plausible wrong version.
				define: releaseDefines(),
				test: {
					name: 'unit',
					include: ['test/unit/**/*.test.ts']
				}
			},
			{
				define: releaseDefines(),
				test: {
					name: 'integration',
					include: ['test/integration/**/*.test.ts'],
					// One registry, state flows scenario to scenario.
					fileParallelism: false,
					testTimeout: 600_000,
					hookTimeout: 600_000,
					// Stream the harness's progress and the CLI's live output instead
					// of buffering it until each test finishes — these flows are slow,
					// and watching them run is how you tell it's working, not hung.
					disableConsoleIntercept: true
				}
			}
		]
	}
})
