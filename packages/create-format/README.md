This package is what users will use to bootstrap a new studio project.

It will need to be deployed to npm and run as an npm create script.

Example:

- User runs `npm create format-project@latest`
- Follows a few prompts
- Gets a new project ready to run `npm run dev`

## Local testing

Fastest loop (no linking):

- `cd packages/create-format && pnpm dev`
- In another terminal: `cd packages && node create-format/dist/index.mjs`

In dev builds, templates keep `workspace:*` versions for `@format.dev/*` deps so you can scaffold inside this monorepo and install with pnpm.

Closest to “published” install:

- `cd packages/create-format && pnpm dev`
- `pnpm -C packages/create-format pack --pack-destination /tmp/create-format-pack`
- `cd "$(mktemp -d)" && pnpm add /tmp/create-format-pack/*.tgz && create-format`

In prod builds, `workspace:*` versions are replaced with published semver ranges (based on the monorepo package versions at build time).

### Project name

`{{ name }}` in the template `package.json` is replaced with the last path segment from “Where should we create your project?”. If you enter `./` or `../`, it defaults to `my-format-project`.
