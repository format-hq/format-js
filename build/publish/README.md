# Publish build modules

Everything a release can decide from the artifacts themselves: which packages
publish, how they are built and packed, what the tarballs must and must not
carry, the order they are approved in, and the record of what was produced.

- `surface.ts` — the publish surface. Names come from `format-release.json`;
  locations come from expanding `pnpm-workspace.yaml` here, in plain Node.
- `artifacts.ts` — building the closure and packing it once.
- `checks.ts` — the content rules, `publint --strict`, and `attw`.
- `order.ts` — the approval order, derived from the manifests.
- `release-manifest.ts` — the record a release writes beside its tarballs.
- `digest.ts` — the sha-512 in npm's own `sha512-<base64>` form.
- `preflight.ts` — the tag, the tree and the registry, checked before packing.
- `toolchain.ts` — the exact Node and npm a release runs on.
- `run.ts` — the composed run the two entry points share.
- `cli.ts` — `check` for a pull request, `release` for a tagged release.
- `stage.ts` — the credential path: verify, then `npm stage publish`.
- `exec.ts` — running programs, and finding installed ones.

## Why these live outside `packages/`

They are part of the **public build system**, not of any package. The mirror
publishes from a tagged commit, and the checks that decide whether a tarball may
publish have to run there, on the tarballs that will be uploaded. So this
directory ships to the mirror alongside `build/release` and
`format-release.json`.

They are equally not runtime code. Nothing here is published to npm: putting it
in a package would place release tooling in every consumer's `node_modules`.

## One implementation, two callers

The mirror's pull-request workflow runs `cli.ts check`. Its tag workflow runs
`cli.ts release`, then `stage.ts` in a second job. The private repository's
packed-artifact smoke, `scripts/packed-artifacts.ts`, calls the same modules
and then does what only the private tree can: installs those exact tarballs
into a project outside the workspace, typechecks a consumer, and drives React
and Vue server rendering, the CLI, and the scaffolder against what came out.

A second implementation of packing or of the tarball checks would let the
mirror publish something the private gate never examined. There is one.

## Two documents, named apart

The release **contract** is `format-release.json`: the version, the engine
target, and the names that publish. It says what a release will contain, and
`build/release` parses it.

The release **manifest** is written during a release, beside the tarballs: the
source commit, the tag, and every package's version, dist-tag, tarball name,
digest and approval position. It records what was actually built, and the
staging job reads nothing else.

## The credential path

`stage.ts` runs in the only job that can mint an npm publishing identity. It
installs nothing, builds nothing, packs nothing, and runs no package script:
running reviewed first-party code is what a release requires, and executing
dependency or project build code while holding a credential is what it must
avoid.

It recomputes every digest rather than trusting the manifest it was handed, and
it passes the dist-tag on every command, so nothing goes live under npm's
default `latest` because an argument was left off.

## Constraints

The directory imports only its own siblings, `build/release`, and Node
builtins — no npm dependencies at all, so `stage.ts` runs in a job that never
installed anything. `scripts/release-contract.test.ts` checks that closure
through the TypeScript AST.

The public entry points run under Node's own TypeScript support rather than a
runner, which is why `tsconfig.json` here sets `erasableSyntaxOnly` and
`verbatimModuleSyntax`: syntax Node cannot strip, or a type imported as a
value, fails the typecheck instead of the release.

The tools these modules drive — `publint`, `attw`, `tar`, `pnpm`, `npm`, `git` —
are resolved from the tree's own install by path, never through `npx`, which
downloads a missing package rather than failing.
