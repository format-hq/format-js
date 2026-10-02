// The versions the CLI writes into a user's package.json for the third-party
// libraries it scaffolds (styling methods and schema libraries). Caret ranges,
// never `latest` — a caret gives the newest non-breaking release at install
// time without risking a surprise major.
//
// These are seeded from the versions our fixtures render against, so a
// recommendation is always something we have tested. See the "Recommended
// dependency versions" section of packages/cli/README.md for the policy and
// the planned Renovate-driven bump flow.
//
// `@format.dev/*` packages are NOT here: they are pinned exactly to `config.version`
// by the lockstep scheme and moved only by `format update`.
export const RECOMMENDED_DEPENDENCY_VERSIONS: Record<string, string> = {
	// Tested core: rendered by the fixture matrix on every version bump.
	zod: '^4.4.3',
	valibot: '^1.4.2',
	tailwindcss: '^4.3.3',
	'@linaria/react': '^7.0.1',
	'@linaria/core': '^7.0.0',
	'@vanilla-extract/css': '^1.21.1',
	'@pandacss/dev': '^1.11.4',
	// Offered as `--schema` choices but NOT in the fixture test matrix. These are
	// best-effort pins so a scaffolded project never gets a bare `latest`; bump
	// them by hand when needed. Both are Standard Schema compliant (joi >= 18,
	// yup >= 1.4).
	joi: '^18.2.3',
	yup: '^1.7.1'
}

// The range to write for a scaffolded third-party dependency. A name we don't
// recognise falls back to `latest` — it should never happen for the fixed
// styling/schema set, but it keeps the caller total.
export function recommendedVersion(name: string): string {
	return RECOMMENDED_DEPENDENCY_VERSIONS[name] ?? 'latest'
}
