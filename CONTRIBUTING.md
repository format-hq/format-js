# Contributing

Contributions are welcome. The mechanics here are unusual, so it is worth reading this before you spend time on anything.

## This repository is generated

Every commit is written by an automated sync from a reviewed commit in Format's private monorepo. Nothing is authored here directly, and a merge into this repository would be erased by the next snapshot.

So a pull request here is a **proposal**, not a merge candidate. When one is accepted, a maintainer applies the change privately, keeps you as a co-author on the commit, and it reaches this repository in the next release snapshot. You keep the attribution; the change just takes a different route.

Issues work normally. Bug reports, questions, and feature requests are all read here.

## Before opening a pull request

Open an issue first for anything beyond a small fix. Changes are ported by hand, so a large diff costs more to accept than it did to write. Better to find out the direction is wanted before either of us spends the time.

## Tests

This repository carries no test suites. Format's tests live in the private monorepo alongside the fixtures and harnesses they need, and the full suite runs there against every change — including the changes that become the snapshots here. The source here is what those tests run against. The one exception is `apps/studio`, which arrives as compiled output, so there is no source of it to test.

A pull request here still gets a run. It builds every package, packs them, and checks the tarballs the way a release does: `publint --strict`, `attw`, and the rules about what a package may publish. That catches an `exports` path resolving to nothing, a file left out of `files`, or a type that only ever resolved through a workspace — none of which a build or a typecheck would notice, and all of which fail for the first person to install the package. It is less than the private gate proves, and it is worth knowing before a change is ported.

You can run the same thing:

```sh
pnpm check:packages
```

## Running the packages locally

```sh
pnpm install
pnpm build
```

Node 22.18 or newer, and pnpm as pinned in `package.json`. The release tooling in `build/publish` runs through Node's own TypeScript support rather than a runner, which is what that floor is for.

The build downloads the rendering engine as a prebuilt binary rather than compiling it, so a clean build needs network access the first time.

## What lives where

- `packages/*` — the SDKs, the compiler, the CLI, and their shared types and utilities
- `apps/studio` — the published Studio package; its source is private, so this directory holds compiled output
- `build/release` — the build-time modules that read the release contract, `format-release.json`
- `build/publish` — the modules that build, pack and check the packages, which both the run above and a release use
- `.github/workflows` — the pull-request run, and the release workflow that a version tag fires

## Reporting a security issue

Do not open a public issue. [SECURITY.md](SECURITY.md) has the process.
