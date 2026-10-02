# @format.dev/client

The JavaScript client for the Format API. Send a document's HTML and assets, and receive the rendered PDF.

See the [client documentation](https://format.dev/docs/api-reference/api-client) for options, asset handling and more examples.

## Installation

```sh
npm install @format.dev/client
```

## Usage

```ts
import { FormatClient } from '@format.dev/client'
import { invoice } from './_generated'

const client = new FormatClient({ apiKey: 'fmt_...' })
const doc = await invoice.render({ customerName: 'Ada Lovelace' })

const res = await client.pdf(doc)
await res.toFile('invoice.pdf')
```

The example uses a compiled renderer in `./_generated`. You can also pass an HTML string to `pdf()`. When no `apiKey` is passed, the client reads the `FORMAT_API_KEY` environment variable.

## In the browser

```ts
import { FormatClient } from '@format.dev/client/web'

const client = new FormatClient({ apiKey })
const res = await client.pdf(doc)
const pdf = await res.blob()
```

When using the web client in a browser, pass your API key explicitly. That key is visible to anyone using the page. To keep it private, make requests from your server.
