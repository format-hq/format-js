# @format.dev/compile

Compiles Format documents into standalone renderers that produce HTML and asset bundles. `format compile` runs this package's `format-compile` bin at the project's pinned version.

## Install

Typically, the Format CLI will run this package in memory at the version pinned in your `format.config.json`. So specifically installing this package is generally only needed if you're working with our bundler plugins or Next.js.

You should install this package using our CLI, which should be installed first.

```bash
npm install @format.dev/cli --save-dev

npx format add compile
```

## Exports

| Subpath     | What it does                                       |
| ----------- | -------------------------------------------------- |
| `.`         | The programmatic `compile()` API                   |
| `./next`    | `withFormat` — the Next.js plugin (default export) |
| `./vite`    | Vite plugin (default export)                       |
| `./rollup`  | Rollup plugin (default export)                     |
| `./webpack` | Webpack plugin (default export)                    |
| `./esbuild` | esbuild plugin (default export)                    |

See the [Format docs](https://format.dev/docs/studio/bundling/overview) for usage examples and integration guides.

## Virtual modules

After compiling, import your documents from `@format:<bundleName>`:

```ts
import documents from '@format:documents'
```

The default bundle name is `documents`. Set a custom name via the `bundleName` option if your project has multiple bundles (e.g. `@format:invoices`).

### Prebundle

The generated `generated/*.mjs` modules (adaptors, sanitiser, wrapper) are injected into user bundles as raw strings, so they must be self-contained. They inline all their dependencies except a small allowlist in `scripts/prebundle-externals.ts`. After changing adaptor or sanitiser source, run `pnpm prebundle` or production compiles will use the old code.
