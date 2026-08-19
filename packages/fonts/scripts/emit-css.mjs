// Emit prebuilt stylesheets next to the generated fonts, for bundler consumers
// (Vite — dyno, studio) to `import '@format.dev/fonts/static.css'` directly: the
// bundler resolves the relative url()s and emits/fingerprints the woff2, no
// serving or generation on the consumer side. Server consumers that can't import
// (press, which uses src: local()) use the fontFaceCss() generator instead.
//
// Relative url()s (baseUrl '.') resolve against this file's location inside
// fonts/, which is the sibling of static/, emoji/, etc.
//
// Run after build-fonts.py + tsdown. Wired into `build:fonts`.
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fontFaceCss } from '../dist/index.mjs'

const fontsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fonts')
const header = '/* GENERATED from fonts.json — do not edit. Run: pnpm --filter @format.dev/fonts build:fonts */\n'

for (const variant of ['static', 'variable']) {
	const css = fontFaceCss({ variant, delivery: 'url', baseUrl: '.' })
	writeFileSync(resolve(fontsRoot, `${variant}.css`), header + css + '\n')
	console.log(`wrote fonts/${variant}.css`, `(${(css.match(/@font-face/g) || []).length} faces)`)
}
