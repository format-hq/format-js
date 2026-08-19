# @format.dev/utils

Shared constants and helpers across the Format platform. This package exists so `@format.dev/zip`, `@format.dev/compile`, Format Studio, and the Format API can depend on one readable source for the values they share. It is not a general-purpose utility library.

## Exports

The MIME module (`src/mime.ts`):

- `MIME_TYPE` maps file extensions to MIME types for every asset Format serves. `USER_MIME_TYPE` is the subset that user uploads may carry.
- `EXT_TO_MIME` and `MIME_TO_EXT` translate between dotted extensions and MIME types, in both directions.
- `getPermittedContentType`, `isFormatAssetExtension`, and `isUserAssetExtension` guard those maps.

The DOM policy lists (`src/dom.ts`):

- `STUDIO_FORBID_TAGS` lists the tags removed from every document, including the Format Studio preview.
- `FORBID_TAGS` is the render-time removal list: `STUDIO_FORBID_TAGS` plus the form elements.
- `UNSUPPORTED_TAGS` lists the tags the Format Studio preview keeps visible but the rendered PDF drops.

## Module format

The package ships ES modules only. Loading it with `require()` needs Node 22.13 or later, which is the floor `@format.dev/zip` declares.

## What belongs here

Code lands here when at least two packages need it, or when a Format user could reasonably import it. Package-specific helpers stay in their package. Type-only declarations belong in `@format.dev/types`.
