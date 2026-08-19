import { drawRandomName } from './draw-random-name.ts'
import { validateDocumentName, suggestAvailableName } from './validate-name.ts'

interface GenerateRandomNameArgs {
	existingNames: string[]
	maxAttempts?: number
}

// A fresh `adjective-animal` name (e.g. "fighting-hippo"), checked against
// existing documents and the validator. Falls back to a numeric suffix if a
// handful of draws all collide.
export function generateRandomName(args: GenerateRandomNameArgs): string {
	const { existingNames, maxAttempts = 10 } = args

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const candidate = drawRandomName()

		if (validateDocumentName({ name: candidate, existingNames }).ok) {
			return candidate
		}
	}

	return suggestAvailableName({ name: drawRandomName(), existingNames })
}
