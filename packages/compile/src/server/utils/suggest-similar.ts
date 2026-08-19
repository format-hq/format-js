// "Did you mean" matching, ported from commander's suggestSimilar so our
// suggestions behave like the ones the CLI already shows for unknown flags.
// https://github.com/tj/commander.js/blob/master/lib/suggestSimilar.js

const MAX_EDIT_DISTANCE = 3
const MIN_SIMILARITY = 0.4

// Optimal string alignment (Damerau-Levenshtein) distance between two words,
// where no substring is edited more than once. `distances[row][column]` holds
// the edit distance between the row-length prefix of `source` and the
// column-length prefix of `target`.
function editDistance(source: string, target: string): number {
	// Early exit with the worst case when the lengths are already too far apart.
	if (Math.abs(source.length - target.length) > MAX_EDIT_DISTANCE) {
		return Math.max(source.length, target.length)
	}

	const distances: number[][] = []

	for (let row = 0; row <= source.length; row++) {
		distances[row] = [row]
	}

	for (let column = 0; column <= target.length; column++) {
		distances[0][column] = column
	}

	for (let column = 1; column <= target.length; column++) {
		for (let row = 1; row <= source.length; row++) {
			const cost = source[row - 1] === target[column - 1] ? 0 : 1

			distances[row][column] = Math.min(
				distances[row - 1][column] + 1, // deletion
				distances[row][column - 1] + 1, // insertion
				distances[row - 1][column - 1] + cost // substitution
			)

			const isTransposition =
				row > 1 && column > 1 && source[row - 1] === target[column - 2] && source[row - 2] === target[column - 1]

			if (isTransposition) {
				distances[row][column] = Math.min(distances[row][column], distances[row - 2][column - 2] + 1)
			}
		}
	}

	return distances[source.length][target.length]
}

interface SuggestSimilarArgs {
	word: string
	candidates: readonly string[]
}

// Return the candidates closest to `word`, best matches first. Empty when
// nothing is similar enough to be a likely typo.
export function suggestSimilar(args: SuggestSimilarArgs): string[] {
	const { word, candidates } = args

	if (candidates.length === 0) {
		return []
	}

	const uniqueCandidates = Array.from(new Set(candidates))

	let similar: string[] = []
	let bestDistance = MAX_EDIT_DISTANCE

	for (const candidate of uniqueCandidates) {
		if (candidate.length <= 1) {
			continue
		}

		const distance = editDistance(word, candidate)
		const length = Math.max(word.length, candidate.length)
		const similarity = (length - distance) / length

		if (similarity <= MIN_SIMILARITY) {
			continue
		}

		if (distance < bestDistance) {
			bestDistance = distance
			similar = [candidate]
			continue
		}

		if (distance === bestDistance) {
			similar.push(candidate)
		}
	}

	return similar.sort((a, b) => a.localeCompare(b))
}
