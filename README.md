# Format

The JavaScript and TypeScript packages for [Format](https://format.dev). Author a document with React, Vue, or HTML, and get a paginated PDF back.

```sh
npm i "@format.dev/react"
```

The quotes matter in PowerShell, which reads an unquoted `@format.dev/react` as an operator.

Documentation lives at [format.dev/docs](https://format.dev/docs).

## What this repository is

A generated mirror. Format is developed in a private monorepo, and every commit here is written by an automated sync from a reviewed release commit — so the history is a series of snapshots rather than individual authored changes.

Two things follow from that:

**Pull requests here cannot be merged.** They are welcome as proposals: open one, and a maintainer ports the change privately, credits you, and it arrives in the next snapshot. A merge into this repository would be overwritten by the next sync.

**Most packages are source, apart from Studio.** The SDKs, the compiler, and the CLI are here as readable source. Studio is the exception: its source is closed, so `apps/studio` contains the built files that get published to npm. You can read every other package; that one you can only install.

The engine is not in this repository at all. It is a compiled binary the packages download at build time.

## Licensing

Most of the SDK surface is MIT. `@format.dev/studio` is under the Elastic License 2.0, `@format.dev/fonts` is `(MIT AND OFL-1.1)`, and the engine is proprietary. Every package carries its own `LICENSE`, and that file is the authority for the package it sits in.

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md). Please do not open a public issue for one.
