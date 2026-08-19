# @format.dev/types

Type declarations shared by the Format SDKs. These interfaces describe a compiled document renderer, the document it produces, and the asset configuration both carry. The package contains types only and adds nothing to your bundle.

## Exports

- `FormatRenderer` describes a compiled document renderer: `render(data)` plus the asset configuration surface.
- `FormatDocument` is the result of `render()`. Pass it directly to `FormatClient.pdf()`.
- `FormatAssetConfig` holds the renderer-scoped asset settings: `getAssetsUrl`, `setAssetsUrl`, and `setZipOptions`.
- `ZipOptions` configures a runtime ZIP build. `@format.dev/zip` re-exports it, so both sides of the compile-and-zip flow share one shape.

## Where these types appear

The SDKs re-export them: `FormatDocument` from `@format.dev/client`, the renderer types from `@format.dev/compile`, and `ZipOptions` from `@format.dev/zip`.

## What belongs here

Types only. Nothing with runtime behavior lands in this package; shared runtime code belongs in `@format.dev/utils`. The JSDoc on these interfaces renders on public format.dev docs, so write with that audience in mind.
