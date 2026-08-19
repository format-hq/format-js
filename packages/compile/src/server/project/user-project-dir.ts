import { createRequire } from 'node:module'
import { join } from 'node:path'

let USER_PROJECT_DIR = process.cwd()

export const setUserProjectDir = (dir: string) => {
	USER_PROJECT_DIR = dir
}

export const getUserProjectDir = () => USER_PROJECT_DIR

export function createUserRequire(cwd?: string) {
	return createRequire(join(cwd || USER_PROJECT_DIR, '__not-a-real-file.js'))
}
