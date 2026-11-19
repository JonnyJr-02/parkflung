import { TIMER_CHOICES } from './timer'
import { WORLDS, type WorldId } from './worlds'

/** The medal a trophy is drawn as: the faster the timer, the rarer the metal. */
export type TrophyMetal = 'diamond' | 'gold' | 'silver' | 'bronze' | 'ruby'

export interface Trophy {
  id: string
  icon: string
  name: string
  /** How to win it. */
  how: string
  metal: TrophyMetal
  /** The world of a timer trophy. */
  world?: WorldId
  /** Seconds of the timer for a timer trophy. */
  seconds?: number
}

const METAL_BY_SECONDS: Record<number, TrophyMetal> = { 15: 'diamond', 30: 'gold', 45: 'silver', 60: 'bronze' }

/** One icon for each world and each timer, from the fastest (15 s) to the slowest (60 s). */
const TIME_ICONS: Record<WorldId, readonly [string, string, string, string]> = {
  parcheggio: ['🐉', '🌙', '🚗', '🅿️'],
  tigros: ['🐯', '🍾', '🛒', '🏷️'],
  casa: ['🐶', '🛟', '🏊', '🍋'],
  varigotti: ['⛵', '🌅', '🌴', '🐚'],
  decanter: ['💀', '🎯', '🍺', '🍻'],
}

export const TROPHIES: readonly Trophy[] = [
  {
    id: 'fine-facile',
    icon: '🏆',
    name: 'Gioco finito',
    how: `Completa il gioco in modalità facile: arriva al traguardo di tutti e ${WORLDS.length} i mondi con hardcore spento.`,
    metal: 'gold',
  },
  {
    id: 'fine-hardcore',
    icon: '🔥',
    name: 'Gioco finito hardcore',
    how: `Completa il gioco in modalità hardcore: arriva al traguardo di tutti e ${WORLDS.length} i mondi con hardcore acceso.`,
    metal: 'ruby',
  },
  ...WORLDS.flatMap((world) =>
    TIMER_CHOICES.map(
      (seconds, index): Trophy => ({
        id: `${world.id}-${seconds}`,
        icon: TIME_ICONS[world.id][index]!,
        name: `${world.name} in ${seconds} s`,
        how: `Arriva ${world.arrival.to} con il timer a ${seconds} secondi per domanda (facile o hardcore).`,
        metal: METAL_BY_SECONDS[seconds]!,
        world: world.id,
        seconds,
      }),
    ),
  ),
]

export function trophyInfo(id: string): Trophy | undefined {
  return TROPHIES.find((trophy) => trophy.id === id)
}

/** The worlds whose arrival was reached in each mode. */
export interface Cleared {
  easy: WorldId[]
  hardcore: WorldId[]
}

/**
 * The trophies an arrival wins. The end of the game in a mode needs the arrival of every world in
 * that mode (`cleared`, this arrival included); the timer trophy needs the world with that timer.
 * `timer` is 0 when the timer was off.
 */
export function trophiesFor({ world, hardcore, timer, cleared }: { world: WorldId; hardcore: boolean; timer: number; cleared: Cleared }): string[] {
  const won: string[] = []
  const done = new Set([...(hardcore ? cleared.hardcore : cleared.easy), world])
  if (WORLDS.every((each) => done.has(each.id))) won.push(hardcore ? 'fine-hardcore' : 'fine-facile')
  if ((TIMER_CHOICES as readonly number[]).includes(timer)) won.push(`${world}-${timer}`)
  return won
}
