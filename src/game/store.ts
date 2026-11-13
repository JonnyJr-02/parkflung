import { useSyncExternalStore } from 'react'
import type { RawQuestion } from './parse'
import { DEFAULT_TIMER, isTimerSeconds, type TimerSeconds } from './timer'
import type { Outcome } from './tiers'

export interface GameRecord {
  /** When the game ended, in milliseconds since the epoch. */
  at: number
  score: number
  outcomes: Outcome[]
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
}

const KEY = 'parkflung:v1'
const MAX_GAMES = 1000
const EMPTY: SavedState = { seen: {}, games: [], custom: [], repeat: true, timerOn: false, timerSeconds: DEFAULT_TIMER }

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
    }
  } catch {
    return EMPTY
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

export function summarize(games: readonly GameRecord[]): { played: number; best: number; average: number } {
  if (games.length === 0) return { played: 0, best: 0, average: 0 }
  const total = games.reduce((sum, game) => sum + game.score, 0)
  return {
    played: games.length,
    best: Math.max(...games.map((game) => game.score)),
    average: Math.round(total / games.length),
  }
}
