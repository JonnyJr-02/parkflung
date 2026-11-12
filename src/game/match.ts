import type { Tier } from './tiers'

export interface AnswerKey {
  /** Normalised tokens joined without spaces: "Spider-Man" → "spiderman". */
  squashed: string
  /** Same, with each token reduced to its stem, so singular and plural meet. */
  stemmed: string
  stems: string[]
}

export interface Answer {
  /** How the answer is shown to the player. */
  label: string
  tier: Tier
  /** One key for the label and one for each accepted alternative spelling. */
  keys: AnswerKey[]
}

const ARTICLES = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'uno', 'una'])

/** Lower case, no accents, no punctuation, no articles. */
export function tokenize(text: string): string[] {
  const plain = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' e ')
    // "C++" and "C#" must not collapse into "C".
    .replace(/[+]/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const all = plain ? plain.split(' ') : []
  const kept = all.filter((token) => !ARTICLES.has(token))
  return kept.length > 0 ? kept : all
}

/** Italian light stemming: drops the final vowels so "banana"/"banane" and "oca"/"oche" share a stem. */
export function stem(token: string): string {
  let out = token
  for (let i = 0; i < 2 && out.length > 2 && /[aeio]$/.test(out); i++) out = out.slice(0, -1)
  if (out.length > 2 && /[cg]h$/.test(out)) out = out.slice(0, -1)
  return out
}

export function makeKey(text: string): AnswerKey {
  const tokens = tokenize(text)
  const stems = tokens.map(stem)
  return { squashed: tokens.join(''), stemmed: stems.join(''), stems }
}

/** Optimal string alignment distance: insertions, deletions, substitutions and swapped neighbours. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0)
    row[0] = i
    return row
  })
  for (let j = 0; j < cols; j++) d[0]![j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1)
      }
      d[i]![j] = best
    }
  }
  return d[rows - 1]![cols - 1]!
}

/** How many typos we forgive, by word length. Three letters or fewer must be exact. */
function allowedTypos(length: number): number {
  if (length <= 3) return 0
  if (length <= 5) return 1
  if (length <= 9) return 2
  return 3
}

export type MatchResult =
  /** Same answer, give or take accents, articles, spaces and singular/plural: accept at once. */
  | { kind: 'exact'; answer: Answer }
  /** Close enough to ask "did you mean…?" before sending. */
  | { kind: 'suggest'; answer: Answer }
  | { kind: 'miss' }

function isSubset(small: string[], big: string[]): boolean {
  return small.length > 0 && small.length < big.length && small.every((token) => big.includes(token))
}

export function matchAnswer(input: string, answers: readonly Answer[]): MatchResult {
  const typed = makeKey(input)
  if (!typed.squashed) return { kind: 'miss' }

  for (const answer of answers) {
    if (answer.keys.some((key) => key.squashed === typed.squashed)) return { kind: 'exact', answer }
  }

  const sameStem = answers.filter((answer) => answer.keys.some((key) => key.stemmed === typed.stemmed))
  if (sameStem.length === 1) return { kind: 'exact', answer: sameStem[0]! }
  if (sameStem.length > 1) return { kind: 'suggest', answer: sameStem[0]! }

  let best: { answer: Answer; distance: number } | undefined
  for (const answer of answers) {
    for (const key of answer.keys) {
      const limit = allowedTypos(Math.max(key.squashed.length, typed.squashed.length))
      if (limit === 0 || Math.abs(key.squashed.length - typed.squashed.length) > limit) continue
      const distance = Math.min(
        editDistance(typed.squashed, key.squashed),
        editDistance(typed.stemmed, key.stemmed),
      )
      if (distance <= limit && (!best || distance < best.distance)) best = { answer, distance }
    }
  }
  if (best) return { kind: 'suggest', answer: best.answer }

  // A part of the answer ("Vinci" for "Leonardo da Vinci") or the answer plus extra words.
  let partial: { answer: Answer; gap: number } | undefined
  for (const answer of answers) {
    for (const key of answer.keys) {
      const typedInside = isSubset(typed.stems, key.stems) && typed.stemmed.length >= 4
      const keyInside = isSubset(key.stems, typed.stems) && key.stemmed.length >= 4
      if (!typedInside && !keyInside) continue
      const gap = Math.abs(key.squashed.length - typed.squashed.length)
      if (!partial || gap < partial.gap) partial = { answer, gap }
    }
  }
  if (partial) return { kind: 'suggest', answer: partial.answer }

  return { kind: 'miss' }
}
