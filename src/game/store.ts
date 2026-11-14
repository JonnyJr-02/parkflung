import { useSyncExternalStore } from 'react'
import type { RawQuestion } from './parse'
import { DEFAULT_TIMER, isTimerSeconds, type TimerSeconds } from './timer'
import { DEFAULT_TARGET, isTarget, type Outcome, type Target } from './tiers'

export interface GameRecord {
  /** When the game ended, in milliseconds since the epoch. */
  at: number
  score: number
  outcomes: Outcome[]
  /** Points of the house for that game; missing in the old five-question games. */
  target?: number
  /** How many questions it took to reach the house. */
  questions?: number
}

/** One answered question of the game in progress, small enough to keep in storage. */
export interface SavedResult {
  id: string
  prompt: string
  typed: string
  outcome: Outcome
  /** Label of the matched answer. */
  answer?: string
  timedOut?: boolean
}

/** The game in progress: it goes on until the house, and comes back when the app is reopened. */
export interface SavedGame {
  target: Target
  startedAt: number
  results: SavedResult[]
  /** The question on screen, so leaving and coming back does not skip it. */
  pending?: string
}

export interface SavedState {
  /** Question id → last time it was played. */
  seen: Record<string, number>
  games: GameRecord[]
  /** Questions added from a file in Impostazioni. */
  custom: RawQuestion[]
  /** When false, a question already played never comes back. */
  repeat: boolean
  /** A countdown on every question; running out counts as a miss. */
  timerOn: boolean
  /** Seconds for each question, kept when the timer is switched off. */
  timerSeconds: TimerSeconds
  /** Points to reach the house in a new game. */
  target: Target
  current: SavedGame | null
}

const KEY = 'parkflung:v1'
const MAX_GAMES = 1000
const EMPTY: SavedState = {
  seen: {},
  games: [],
  custom: [],
  repeat: true,
  timerOn: false,
  timerSeconds: DEFAULT_TIMER,
  target: DEFAULT_TARGET,
  current: null,
}

function read(): SavedState {
  try {
    const text = localStorage.getItem(KEY)
    if (!text) return EMPTY
    const data = JSON.parse(text) as Partial<SavedState>
    return {
      seen: data.seen && typeof data.seen === 'object' ? data.seen : {},
      games: Array.isArray(data.games) ? data.games : [],
      custom: Array.isArray(data.custom) ? data.custom : [],
      repeat: data.repeat !== false,
      timerOn: data.timerOn === true,
      timerSeconds: isTimerSeconds(data.timerSeconds) ? data.timerSeconds : DEFAULT_TIMER,
      target: isTarget(data.target) ? data.target : DEFAULT_TARGET,
      current: readGame(data.current),
    }
  } catch {
    return EMPTY
  }
}

function readGame(value: unknown): SavedGame | null {
  if (!value || typeof value !== 'object') return null
  const game = value as Partial<SavedGame>
  if (!isTarget(game.target) || !Array.isArray(game.results)) return null
  return {
    target: game.target,
    startedAt: typeof game.startedAt === 'number' ? game.startedAt : Date.now(),
    results: game.results.filter((result) => result && typeof result.id === 'string' && typeof result.outcome === 'string'),
    pending: typeof game.pending === 'string' ? game.pending : undefined,
  }
}

let state: SavedState = read()
const listeners = new Set<() => void>()

/** False when the browser refused to save (private mode, storage full). */
export function update(change: (current: SavedState) => SavedState): boolean {
  state = change(state)
  listeners.forEach((listener) => listener())
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function getState(): SavedState {
  return state
}

export function useSavedState(): SavedState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export function markSeen(ids: string[], at = Date.now()): void {
  update((current) => {
    const seen = { ...current.seen }
    ids.forEach((id) => (seen[id] = at))
    return { ...current, seen }
  })
}

export function recordGame(game: GameRecord): void {
  update((current) => ({ ...current, games: [...current.games, game].slice(-MAX_GAMES) }))
}

export function saveGame(game: SavedGame | null): void {
  update((current) => ({ ...current, current: game }))
}
