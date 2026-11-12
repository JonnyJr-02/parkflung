import { compile, parseText, questionId, type Question, type RawQuestion } from './parse'

const packs = import.meta.glob<string>('../data/*.txt', { query: '?raw', import: 'default', eager: true })

/** The questions shipped with the app, parsed once. */
export const builtIn: { questions: RawQuestion[]; problems: string[] } = (() => {
  const questions: RawQuestion[] = []
  const problems: string[] = []
  for (const [file, text] of Object.entries(packs).sort(([a], [b]) => a.localeCompare(b))) {
    const parsed = parseText(text)
    questions.push(...parsed.questions)
    problems.push(...parsed.problems.map((problem) => `${file}: ${problem}`))
  }
  return { questions, problems }
})()

/** Built-in questions plus the uploaded ones; an uploaded question replaces a built-in one with the same text. */
export function mergeBank(custom: readonly RawQuestion[]): Question[] {
  const byId = new Map<string, Question>()
  for (const raw of [...builtIn.questions, ...custom]) {
    const question = compile(raw)
    if (question.answers.length > 0) byId.set(question.id, question)
  }
  return [...byId.values()]
}

/** Adds uploaded questions to the stored ones, replacing those with the same text. */
export function mergeCustom(
  current: readonly RawQuestion[],
  incoming: readonly RawQuestion[],
): { custom: RawQuestion[]; added: number; replaced: number } {
  const byId = new Map(current.map((raw) => [questionId(raw.q), raw]))
  let added = 0
  let replaced = 0
  for (const raw of incoming) {
    const id = questionId(raw.q)
    if (byId.has(id)) replaced++
    else added++
    byId.set(id, raw)
  }
  return { custom: [...byId.values()], added, replaced }
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const held = out[i]!
    out[i] = out[j]!
    out[j] = held
  }
  return out
}

/** Never-played questions first, in random order; when they run out, the ones played longest ago. */
export function pickQuestions(
  bank: readonly Question[],
  seen: Readonly<Record<string, number>>,
  count: number,
  random: () => number = Math.random,
): Question[] {
  const fresh = shuffle(
    bank.filter((question) => seen[question.id] === undefined),
    random,
  )
  if (fresh.length >= count) return fresh.slice(0, count)
  const played = shuffle(
    bank.filter((question) => seen[question.id] !== undefined),
    random,
  ).sort((a, b) => seen[a.id]! - seen[b.id]!)
  return shuffle([...fresh, ...played.slice(0, count - fresh.length)], random)
}

export function countFresh(bank: readonly Question[], seen: Readonly<Record<string, number>>): number {
  return bank.filter((question) => seen[question.id] === undefined).length
}
