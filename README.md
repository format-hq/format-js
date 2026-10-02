# Format

[Format](https://format.dev) lets you build PDFs with React, Vue, or HTML and CSS. Design in your editor, preview in Studio, and generate PDFs through the API.

- **[Automatic tables of contents](https://format.dev/docs/document-model/types/table-of-contents).** Turn headings into linked entries with section numbers and final page numbers. Long contents lists paginate with the document.
- **[Numbering and cross-references](https://format.dev/docs/document-model/numbering).** Define chapter, section, figure, and table numbering. Reference a section, a figure, or the page it appears on. Format resolves the numbers as your content changes.
- **[Footnotes and endnotes](https://format.dev/docs/document-model/types/footnotes).** Keep notes on the pages that cite them, or collect them into an endnotes section.
- **[Page layout and pagination](https://format.dev/docs/document-model/pagination).** Flow text and tables across pages, repeat headers and footers, and combine different page layouts in one document.
- **[Live preview in Studio](https://format.dev/docs/studio/overview).** See your document update as you save. Switch between data variants to test different content, and generate PDFs through the same API you use in production.

[Documentation](https://format.dev/docs) · [Quick start](https://format.dev/docs/introduction/quick-start) · [API reference](https://format.dev/docs/api-reference/overview)

## Get started

Create a project with Node.js 22.12 or later:

```sh
npm create format@latest
```

Choose React, Vue, or HTML and follow the prompts to install dependencies. Then start Studio from your new project directory:

```sh
npm run dev
```

Open [localhost:1234](http://localhost:1234), sign in, and edit the example in `documents/welcome`. Studio updates the preview as you save.

Format is currently in invite-only beta. Studio and API access require an invited account.

To add Format to an existing application, follow the [installation guide](https://format.dev/docs/studio/installation#existing-codebase). The [first PDF tutorial](https://format.dev/docs/introduction/build-your-first-pdf) walks through layouts, flowing content, tables, and page numbers.

## Generate a PDF

Compile the starter document for use in your application:

```sh
npm run compile
```

Create an API key in the [dashboard](https://dash.format.dev) and set `FORMAT_API_KEY` in your server environment.

Save this as `render.mjs` in the project directory and run `node render.mjs`:

```js
import { FormatClient } from '@format.dev/client'
import { welcome } from './_generated/index.js'

const format = new FormatClient()
const document = await welcome.render({ name: 'Ada' })
const pdf = await format.pdf(document)

await pdf.toFile('welcome.pdf')
```

The renderer prepares the document's HTML and assets. The client sends them to the API, and `toFile()` saves the PDF.

Read the [client guide](https://format.dev/docs/api-reference/api-client) for browser and edge support, asset handling, and errors. The [deployment guide](https://format.dev/docs/studio/deployment/overview) covers bringing your documents into production.

## Packages

| Package                                                                  | Purpose                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [`create-format`](packages/create-format)                                | Create a project with a working example.                                |
| [`@format.dev/react`](packages/react), [`@format.dev/vue`](packages/vue) | Author documents with React or Vue components.                          |
| [`@format.dev/studio`](apps/studio)                                      | Preview documents locally and integrate with your bundler.              |
| [`@format.dev/cli`](packages/cli)                                        | Set up projects, manage packages, and compile documents.                |
| [`@format.dev/client`](packages/client)                                  | Generate PDFs through the API from Node.js, browsers, or edge runtimes. |
| [`@format.dev/compile`](packages/compile)                                | Compile document templates programmatically.                            |
| [`@format.dev/zip`](packages/zip)                                        | Package document assets for the API.                                    |
| [`@format.dev/fonts`](packages/fonts)                                    | Use Format's font catalogue in your documents.                          |

## About this repository

This is a generated mirror of Format's private development repository. Reviewed changes arrive here as snapshots rather than individual development commits.

The SDKs, compiler, and CLI are included as source. Studio's source is private. The `apps/studio` directory contains its built npm package. The rendering engine is distributed separately as a compiled binary.

Use [issues](https://github.com/format-hq/format-js/issues) for bug reports, questions, and feature requests.

Pull requests are welcome as proposals. They cannot be merged directly here because the next sync would overwrite them. Maintainers apply accepted changes in the development repository, preserve your attribution, and include them in a subsequent release snapshot. Read the [contribution guide](CONTRIBUTING.md) for the process and local build instructions.

## Licensing

Most SDK packages use the MIT License. `@format.dev/studio` uses the Elastic License 2.0, and `@format.dev/fonts` uses `(MIT AND OFL-1.1)`. The rendering engine is proprietary.

Each package's `LICENSE` file defines its terms.

## Security

Please report vulnerabilities privately using the process in [SECURITY.md](SECURITY.md).
