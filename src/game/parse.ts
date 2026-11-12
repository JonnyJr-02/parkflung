import { makeKey, type Answer } from './match'
import { TIERS, type Tier } from './tiers'

/**
 * A question as it is written in a file and kept in storage. Every answer is a string;
 * alternative spellings of the same answer are separated by "/": "kiwi/kivi".
 */
export interface RawQuestion {
  q: string
  c: string[]
  n: string[]
  r: string[]
  e: string[]
  t: string[]
}

export interface Question {
  id: string
  prompt: string
  answers: Answer[]
}

export interface ParseResult {
  questions: RawQuestion[]
  /** Reasons, in Italian, for every entry that was skipped. */
  problems: string[]
}

/** Long Italian names accepted in JSON files next to the one-letter keys. */
const TIER_NAMES: Record<Tier, string[]> = {
  c: ['c', 'comune', 'comuni'],
  n: ['n', 'noncomune', 'noncomuni', 'non_comune', 'non comune'],
  r: ['r', 'rara', 'rare', 'raro'],
  e: ['e', 'esclusiva', 'esclusive', 'esclusivo'],
  t: ['t', 'top', 'farflung'],
}

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function questionId(prompt: string): string {
  return hash(makeKey(prompt).squashed)
}

function cleanList(value: unknown): string[] {
  const items: unknown[] = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : []
  return items.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

function check(raw: RawQuestion, where: string, problems: string[]): RawQuestion | undefined {
  if (!raw.q) {
    problems.push(`${where}: manca il testo della domanda.`)
    return undefined
  }
  if (TIERS.reduce((sum, tier) => sum + raw[tier].length, 0) === 0) {
    problems.push(`${where} («${raw.q}»): non ha nessuna risposta.`)
    return undefined
  }
  return raw
}

/**
 * Text format, one question per line:
 * `domanda :: comuni :: non comuni :: rare :: esclusive :: top`
 * with answers separated by commas. Empty lines and lines starting with # are ignored.
 */
export function parseText(text: string): ParseResult {
  const questions: RawQuestion[] = []
  const problems: string[] = []
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const parts = trimmed.split('::').map((part) => part.trim())
    const where = `Riga ${index + 1}`
    if (parts.length !== 6) {
      problems.push(`${where}: servono 6 parti separate da «::», trovate ${parts.length}.`)
      return
    }
    const raw = check(
      {
        q: parts[0]!,
        c: cleanList(parts[1]),
        n: cleanList(parts[2]),
        r: cleanList(parts[3]),
        e: cleanList(parts[4]),
        t: cleanList(parts[5]),
      },
      where,
      problems,
    )
    if (raw) questions.push(raw)
  })
  return { questions, problems }
}

function pick(source: Record<string, unknown>, names: string[]): unknown {
  for (const [key, value] of Object.entries(source)) {
    if (names.includes(key.toLowerCase())) return value
  }
  return undefined
}

/** JSON format: a list of questions, or an object with the list under "domande". */
export function parseJson(value: unknown): ParseResult {
  const problems: string[] = []
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? pick(value as Record<string, unknown>, ['domande', 'questions'])
      : undefined
  if (!Array.isArray(list)) {
    return { questions: [], problems: ['Il file JSON deve contenere una lista di domande.'] }
  }
  const questions: RawQuestion[] = []
  list.forEach((entry: unknown, index) => {
    const where = `Domanda ${index + 1}`
    if (!entry || typeof entry !== 'object') {
      problems.push(`${where}: non è un oggetto.`)
      return
    }
    const object = entry as Record<string, unknown>
    const nested = pick(object, ['risposte', 'answers'])
    const answers = nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : object
    const prompt = pick(object, ['q', 'domanda', 'question'])
    const raw = check(
      {
        q: typeof prompt === 'string' ? prompt.trim() : '',
        c: cleanList(pick(answers, TIER_NAMES.c)),
        n: cleanList(pick(answers, TIER_NAMES.n)),
        r: cleanList(pick(answers, TIER_NAMES.r)),
        e: cleanList(pick(answers, TIER_NAMES.e)),
        t: cleanList(pick(answers, TIER_NAMES.t)),
      },
      where,
      problems,
    )
    if (raw) questions.push(raw)
  })
  return { questions, problems }
}

/** Reads an uploaded file: JSON when it looks like JSON, otherwise the text format. */
export function parseUpload(text: string): ParseResult {
  const trimmed = text.replace(/^﻿/, '').trim()
  if (!trimmed) return { questions: [], problems: ['Il file è vuoto.'] }
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return parseJson(JSON.parse(trimmed))
    } catch {
      return { questions: [], problems: ['Il file JSON non è valido (controlla virgole e parentesi).'] }
    }
  }
  return parseText(trimmed)
}

/** Turns a stored question into one ready for matching. An answer listed twice keeps its commonest tier. */
export function compile(raw: RawQuestion): Question {
  const answers: Answer[] = []
  const taken = new Set<string>()
  for (const tier of TIERS) {
    for (const entry of raw[tier]) {
      const forms = entry
        .split('/')
        .map((form) => form.trim())
        .filter(Boolean)
      const keys = forms.map(makeKey).filter((key) => key.squashed && !taken.has(key.squashed))
      if (keys.length === 0) continue
      keys.forEach((key) => taken.add(key.squashed))
      answers.push({ label: forms[0]!, tier, keys })
    }
  }
  return { id: questionId(raw.q), prompt: raw.q, answers }
}
