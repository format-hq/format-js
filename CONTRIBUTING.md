# Contributing

Help improve Format by reporting bugs, sharing ideas, or proposing changes to the packages in this repository.

## How contributions reach Format

This repository is a generated mirror of Format's private development repository. Reviewed changes arrive here as snapshots. Direct merges into the mirror would be overwritten by the next sync.

Pull requests are reviewed as proposals. When a change is accepted, a maintainer applies it in the development repository and credits you as a co-author. It is checked there and included in a subsequent release snapshot.

## Report a bug or suggest a change

Open an [issue](https://github.com/format-hq/format-js/issues) for bug reports, questions, and feature requests. For a bug, include the package version, your runtime, the expected result, and what happened instead. A small reproduction helps us investigate.

Before starting a substantial change, open an issue to discuss the approach. Small fixes can go straight to a pull request. Keep the change focused and describe how you checked it.

For vulnerabilities, use the private reporting process in [SECURITY.md](SECURITY.md).

## Work locally

Local builds require Node.js 22.18 or later and the pnpm version pinned in [package.json](package.json). CI's exact Node.js and npm versions are recorded in [build/publish/toolchain.ts](build/publish/toolchain.ts).

Install dependencies, typecheck the build tooling, and check the packages:

```sh
pnpm install --frozen-lockfile
pnpm typecheck:release
pnpm check:packages
```

`check:packages` builds the packages, packs their npm tarballs, and validates the files, exports, and TypeScript declarations with `publint --strict`, `attw`, and Format's package checks. Use `pnpm build` when iterating on package source.

The build downloads a prebuilt rendering engine, so the first run needs network access.

## Checks and tests

Pull requests run the same build tooling and package checks described above. These verify that the packages build and their npm tarballs contain the expected files, entry points, and types.

Format's test suites run in the development repository alongside their fixtures and harnesses. They are not included in this mirror. Maintainers run the relevant tests when applying an accepted contribution.

## Repository layout

| Path                 | Contents                                           |
| -------------------- | -------------------------------------------------- |
| `packages/`          | SDKs, compiler, CLI, shared types, and utilities.  |
| `apps/studio/`       | Studio's built npm package. Its source is private. |
| `build/release/`     | Shared tooling for reading `format-release.json`.  |
| `build/publish/`     | Package build, packing, and validation tooling.    |
| `.github/workflows/` | Pull-request checks and the npm release workflow.  |
