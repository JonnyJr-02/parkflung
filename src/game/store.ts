import { useSyncExternalStore } from 'react'
import type { RawQuestion } from './parse'
import { isPrize, type Met } from './surprise'
import { DEFAULT_TIMER, isTimerSeconds, type TimerSeconds } from './timer'
import type { Outcome } from './tiers'
import { isWorldId, WORLDS, type WorldId } from './worlds'

export interface GameRecord {
  /** When the game ended, in milliseconds since the epoch. */
  at: number
  score: number
  outcomes: Outcome[]
  /** Points of the arrival for that game; missing in the old five-question games. */
  target?: number
  /** How many questions it took. */
  questions?: number
  /** The world it was played in; missing before the five worlds. */
  world?: WorldId
  /** The arrival was reached. */
  arrived?: boolean
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
  /** Answered a second time with the Carta Rivincita. */
  retried?: boolean
  /** Worth double points: answered with the Carta Diamante. */
  double?: boolean
}

/** A game in progress in one world: it goes on until the arrival, and comes back when the app is reopened. */
export interface SavedGame {
  world: WorldId
  startedAt: number
  results: SavedResult[]
  /** The question on screen, so leaving and coming back does not skip it. */
  pending?: string
  /** The "?" squares met so far: the wheel's prize, or null when skipped. */
  met?: Met
  /** The question on screen already answered once more with the Carta Rivincita. */
  retried?: string
  /** Played in hardcore mode (with misses). */
  hardcore?: boolean
  /** Questions swapped for another with «cambia domanda»: they count against the swaps and do not come back. */
  swapped?: string[]
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
  /** Hardcore mode for new games: misses, and one question every 25 points. Off by default. */
  hardcore: boolean
  /** Sound effects: the thermometer, and a chime when a step or a world unlocks. */
  soundOn: boolean
  /** The tune of the world on screen. */
  musicOn: boolean
  /** The world shown on the home screen. */
  world: WorldId
  /** Worlds whose arrival was reached: each one unlocks the next. */
  reached: WorldId[]
  /** The game in progress in each world. */
  playing: Partial<Record<WorldId, SavedGame>>
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
  hardcore: false,
  soundOn: true,
  musicOn: true,
  world: WORLDS[0]!.id,
  reached: [],
  playing: {},
}

function read(): SavedState {
  try {
    const text = localStorage.getItem(KEY)
    if (!text) return EMPTY
    const data = JSON.parse(text) as Partial<SavedState>
    const playing: Partial<Record<WorldId, SavedGame>> = {}
    // Games saved before the five worlds (one game, no world) are left behind.
    if (data.playing && typeof data.playing === 'object') {
      for (const [id, value] of Object.entries(data.playing)) {
        const game = readGame(value)
        if (isWorldId(id) && game && game.world === id) playing[id] = game
      }
    }
    return {
      seen: data.seen && typeof data.seen === 'object' ? data.seen : {},
      games: Array.isArray(data.games) ? data.games : [],
      custom: Array.isArray(data.custom) ? data.custom : [],
      repeat: data.repeat !== false,
      timerOn: data.timerOn === true,
      timerSeconds: isTimerSeconds(data.timerSeconds) ? data.timerSeconds : DEFAULT_TIMER,
      hardcore: data.hardcore === true,
      soundOn: data.soundOn !== false,
      musicOn: data.musicOn !== false,
      world: isWorldId(data.world) ? data.world : EMPTY.world,
      reached: Array.isArray(data.reached) ? data.reached.filter(isWorldId) : [],
      playing,
    }
  } catch {
    return EMPTY
  }
}

function readGame(value: unknown): SavedGame | null {
  if (!value || typeof value !== 'object') return null
  const game = value as Partial<SavedGame>
  if (!isWorldId(game.world) || !Array.isArray(game.results)) return null
  return {
    world: game.world,
    startedAt: typeof game.startedAt === 'number' ? game.startedAt : Date.now(),
    results: game.results.filter((result) => result && typeof result.id === 'string' && typeof result.outcome === 'string'),
    pending: typeof game.pending === 'string' ? game.pending : undefined,
    met: readMet(game.met),
    retried: typeof game.retried === 'string' ? game.retried : undefined,
    hardcore: game.hardcore === true,
    swapped: Array.isArray(game.swapped) ? game.swapped.filter((id): id is string => typeof id === 'string') : undefined,
  }
}

function readMet(value: unknown): Met | undefined {
  if (!value || typeof value !== 'object') return undefined
  const met: Met = {}
  for (const [key, prize] of Object.entries(value)) {
    const index = Number(key)
    if (Number.isInteger(index) && index >= 0 && (prize === null || isPrize(prize))) met[index] = prize
  }
  return met
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

/** Called after every change of the saved state; returns the function that stops it. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
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

/** Saves the game in progress of a world, or forgets it (null). */
export function saveGame(world: WorldId, game: SavedGame | null): void {
  update((current) => {
    const playing = { ...current.playing }
    if (game) playing[world] = game
    else delete playing[world]
    return { ...current, playing }
  })
}

/** The walker reached the arrival of a world: the next one opens. */
export function markReached(world: WorldId): void {
  update((current) => (current.reached.includes(world) ? current : { ...current, reached: [...current.reached, world] }))
}
