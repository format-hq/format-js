import { readFile as _readFile } from 'fs/promises'

export async function readFile(path: string): Promise<any | null> {
	try {
		return JSON.parse(await _readFile(path, 'utf-8'))
	} catch {
		return null
	}
}
