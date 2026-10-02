import { uniqueNamesGenerator, colors, animals } from 'unique-names-generator'

// A fresh `colour-animal` name, e.g. "amber-otter". The colours and animals
// dictionaries are curated and safe — unlike `adjectives`, which can surface
// crass words.
export function drawRandomName(): string {
	return uniqueNamesGenerator({
		dictionaries: [colors, animals],
		separator: '-',
		style: 'lowerCase'
	})
}
