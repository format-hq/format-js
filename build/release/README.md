# Release build modules

Build-time modules that read the release contract, `format-release.json`, and
hand its two numbers to the package builds.

- `manifest.ts` — parses and validates the contract. The one definition of what
  that file means.
- `version.ts` — the strict version grammar: exact releases only, no ranges,
  prereleases, leading zeroes, or components past the safe integer range.
- `constants.ts` — the `define` entries a build passes to its bundler:
  `FORMAT_JS_VERSION`, the version the packages publish at, and
  `FORMAT_ENGINE_TARGET`, the released engine their output targets.

## Why substitution, and not a static import

A package could import `format-release.json` directly, and a bundler would
inline it to the same literal. That is not enough, because the same SDK source
is built in three contexts that do not all want the same number:

| built by                     | stamps                       |
| ---------------------------- | ---------------------------- |
| the published package        | the released engine target   |
| compile, bundling SDK source | the released engine target   |
| dyno, bundling SDK source    | the engine built in the tree |

Dyno is the engine development harness, so a document previewed there is
rendered by the engine currently built in the tree rather than the last released
one. A static import hardcodes one number at every site, which would leave dyno
previewing against the released engine as soon as the two diverge. While they
are equal, no test can tell the difference.

A placeholder each build substitutes lets every boundary supply its own answer.
The value must reach the source as a **free identifier**, because `define`
replaces free identifiers and not import bindings. That is why each package
holds a small module declaring the identifier instead of importing a constant.

Nothing falls back at runtime. A build that fails to substitute either fails
outright or leaves an unresolved identifier, rather than stamping a plausible
wrong version.

## Why these live outside `packages/`

They are part of the **public build system**, not of any package.
`@format.dev/react`, `@format.dev/vue`, `@format.dev/compile`, and
`@format.dev/cli` are built from source in the public mirror, and their build
configurations import from here, so this directory ships to the mirror as one
unit alongside `format-release.json`.

They are equally not runtime code. Nothing here is published to npm: putting it
in a package would place build tooling in every consumer's `node_modules` and
turn an internal contract into apparent public API.

## What stays private

Release _mutation_ — `set-js-version`, which stamps a new publish version across
the workspace — lives in the private repo's `scripts/`. The mirror needs only
the read, validate, and define side, which is what this directory is.

## Constraints

The directory is **module-closed**: it imports only its own siblings and Node
builtins. It reads one external file, `format-release.json`, resolved from the
repo root rather than by a literal path.

The mirror copies this folder wholesale, along with the root
`tsconfig.release.json` that `tsconfig.json` here extends. That root config
holds only shared compiler options and includes only this directory, so it stays
valid in a tree with no `scripts/`.

An import reaching into the private repo resolves in this repo and fails in the
mirror. `scripts/release-contract.test.ts` checks the closure through the
TypeScript AST, so no import form slips past.
