# @format.dev/zip

Bundles the assets a Format document references. The scanners find asset references in HTML and CSS, the resolvers read their bytes, and `zip()` packs the archive that travels to the Format API alongside the document.

## Entry points

- `.` is the Node entry: `zip()`, `zipDir`, the scanners, the resolvers (`dirResolver`, `urlResolver`), and the error types.
- `./web` runs in browsers, workers, and edge runtimes. It is fully self-contained, because compiled document wrappers import it from bundled code that cannot resolve its dependencies.
- `./scan` is the slim scanner entry: `scanAssetRefs` and `scanRemoteRefs` only, for compiled documents that never build a ZIP at runtime.

Remote asset references are not fetched unless `remoteAssets` is enabled in `ZipOptions`. Fetching per render makes the network a render-time failure mode, so prefer local files.

## Node support

Node 22.13 or later. The package ships ES modules only. CommonJS consumers load them through Node's `require()` support for ES modules, which every version from the floor upward provides.
