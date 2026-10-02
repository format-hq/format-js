import { defineConfig } from 'tsdown'
import { makeConfig } from './tsdown.shared.ts'

export default defineConfig(makeConfig('prod'))
