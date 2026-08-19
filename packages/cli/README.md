# @format.dev/cli

This CLI exposes the `format` binary: the front door to Format. Install this package to scaffold projects, compile documents, and run the Studio dev server.

There are two key advantages to using the Format CLI.

1. It pins all Format packages to a single version defined in your `format.config.json` and provides an interface to update or migrate to different versions in one command.

2. It runs `@format.dev/studio` and `@format.dev/compile` as transient dependencies that are run in memory when called on. For you this means less dependencies need to be installed at CI if they're not strictly needed.

## Install

```bash
npm install @format.dev/cli --save-dev
```

## Commands

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `format dev`          | Start the Format Studio dev server                                   |
| `format compile`      | Compile documents into standalone renderers                          |
| `format new project`  | Creates a completely fresh Format setup. Recommended for fresh repos |
| `format init`         | Boostraps Format into an existing repo                               |
| `format new document` | Scaffolds a new document                                             |
| `format update`       | Updates to the latest Format version                                 |
| `format version`      | Prints the current Format version you're using                       |

## Documentation

The [docs](https://format.dev/docs/cli/overview) for the CLI.

## The lockstep model

All public Format packages release in lockstep. The `version` field in `format.config.json` pins which release your project uses, and `format update` is the most consistent way to move it up or down.

Format doesn't use the peer dependency model to enforce the dependency between our packages. It's all driven from this CLI.

## Config

`format.config.json` is JSON. It holds your version and project settings. The `$schema` URL at `format.dev/schema/format-config.json` gives you editor autocomplete. [Docs](https://format.dev/docs/studio/configuration).
