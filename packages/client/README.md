# @format.dev/client

The JavaScript client for the Format API. Send a document's HTML and assets, and receive the rendered PDF.

## Usage

```ts
import { FormatClient } from '@format.dev/client'

const client = new FormatClient({ apiKey: 'fmt_...' })

// doc is a FormatDocument from your compiled renderer
const res = await client.pdf(doc)
await res.toFile('invoice.pdf')
```

The `pdf()` method accepts a `FormatDocument` from a compiled renderer, or an HTML string with an assets ZIP in its options. The response streams: write it with `toFile()` in Node, or read it with `arrayBuffer()` in any runtime. When no `apiKey` is passed, the client reads the `FORMAT_API_KEY` environment variable.

## Exports

The package exports `FormatClient`, the `FormatError` thrown for error responses (carrying the HTTP `status` and the parsed error `detail`), and the types `FormatDocument`, `FormatOptions`, `FormatPdfOptions`, `FormatResponse`, `AssetLike`, and `FormatRegion`.
