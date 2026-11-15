import type { Tier } from './tiers'

export interface AnswerKey {
  /** Normalised tokens joined without spaces: "Spider-Man" → "spiderman". */
  squashed: string
  /** Same, with each token reduced to its stem, so singular and plural meet. */
  stemmed: string
  stems: string[]
  /** The stems without the little words ("di", "della", "e"…), in order: "frutto della passione" → frutt, passion. */
  words: string[]
  /** The same words sorted, so that "Pisa torre" and "Torre di Pisa" meet. */
  loose: string
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

/** Little words that do not change an answer: "frutto passione" is "frutto della passione". */
const FILLERS = new Set([
  'di', 'del', 'dello', 'della', 'dell', 'dei', 'degli', 'delle', 'd',
  'da', 'dal', 'dallo', 'dalla', 'dall', 'dai', 'dagli', 'dalle',
  'a', 'ad', 'al', 'allo', 'alla', 'all', 'ai', 'agli', 'alle',
  'in', 'nel', 'nello', 'nella', 'nell', 'nei', 'negli', 'nelle',
  'con', 'col', 'coi', 'su', 'sul', 'sullo', 'sulla', 'sull', 'sui', 'sugli', 'sulle',
  'per', 'tra', 'fra', 'e', 'ed', 'o', 'the', 'of', 'and',
])

export function makeKey(text: string): AnswerKey {
  const tokens = tokenize(text)
  const stems = tokens.map(stem)
  const content = stems.filter((_, index) => !FILLERS.has(tokens[index]!))
  const words = content.length > 0 ? content : stems
  return { squashed: tokens.join(''), stemmed: stems.join(''), stems, words, loose: [...words].sort().join(' ') }
}

/** The same answer without the words in brackets, which only explain it: "Ade (Hercules)" → "Ade". */
export function withoutBrackets(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
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

  // The same words, give or take the little ones and the order: "frutto passione", "Pisa torre".
  const sameWords = answers.filter((answer) => answer.keys.some((key) => key.loose === typed.loose))
  if (sameWords.length === 1) return { kind: 'exact', answer: sameWords[0]! }
  if (sameWords.length > 1) return { kind: 'suggest', answer: sameWords[0]! }

  // A part of the answer ("Vinci" for "Leonardo da Vinci") or the answer plus extra words. A part of
  // one answer only counts at once when it holds the name, that is the last word ("Montalbano" for
  // "Il commissario Montalbano"); otherwise we ask, as for extra words ("Alberto Angela" is not
  // "Piero Angela/Angela"). Whole words come before typos: "torre" is a part of "Torre Eiffel" more
  // than a typo of "torta".
  let partial: { answer: Answer; gap: number } | undefined
  const found = new Set<Answer>()
  let sure = false
  for (const answer of answers) {
    for (const key of answer.keys) {
      const typedInside = isSubset(typed.stems, key.stems) && typed.stemmed.length >= 4
      const keyInside = isSubset(key.stems, typed.stems) && key.stemmed.length >= 4
      if (!typedInside && !keyInside) continue
      found.add(answer)
      if (typedInside && typed.stems.includes(key.words[key.words.length - 1]!)) sure = true
      const gap = Math.abs(key.squashed.length - typed.squashed.length)
      if (!partial || gap < partial.gap) partial = { answer, gap }
    }
  }
  if (partial) return { kind: found.size === 1 && sure ? 'exact' : 'suggest', answer: partial.answer }

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

  // The words of the answer with a typo: "montalbamo" for "Il commissario Montalbano".
  const typedWords = typed.words.filter((word) => word.length >= 4)
  let close: { answer: Answer; typos: number } | undefined
  if (typedWords.length > 0) {
    for (const answer of answers) {
      for (const key of answer.keys) {
        let typos = 0
        const all = typedWords.every((word) => {
          const best = Math.min(...key.words.map((other) => editDistance(word, other)))
          const other = key.words.find((candidate) => editDistance(word, candidate) === best) ?? ''
          if (best > allowedTypos(Math.max(word.length, other.length))) return false
          typos += best
          return true
        })
        if (all && (!close || typos < close.typos)) close = { answer, typos }
      }
    }
  }
  if (close) return { kind: 'suggest', answer: close.answer }

  return { kind: 'miss' }
}
