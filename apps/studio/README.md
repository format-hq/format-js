# @format.dev/studio

Studio is the local authoring tool for [Format](https://format.dev): it serves your document, re-renders it as you edit, and shows the paginated result.

Most people never install this package directly. The CLI depends on it and starts it for you:

```sh
npm i -D "@format.dev/cli"
npx format dev
```

Installing it yourself is useful when you want to pin the version a project runs, or start Studio from a script:

```sh
npm i -D "@format.dev/studio"
npx format-studio dev
```

Documentation lives at [format.dev/docs](https://format.dev/docs).

## What ships here

The built application. Studio's source is closed, so this package contains the compiled files and nothing else. The rest of Format is published as readable source; the [repository README](https://github.com/format-hq/format-js) covers how the two fit together.

## Licence

Elastic License 2.0. See [LICENSE](LICENSE), and [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES) for the dependencies bundled into the build.
