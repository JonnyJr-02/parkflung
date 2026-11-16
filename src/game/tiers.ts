/** Rarity tiers, from the most obvious answers (c) to the rarest (t). */
export type Tier = 'c' | 'n' | 'r' | 'e' | 't'
export type Outcome = Tier | 'miss'

export const TIERS: readonly Tier[] = ['c', 'n', 'r', 'e', 't']
export const OUTCOMES: readonly Outcome[] = ['miss', 'c', 'n', 'r', 'e', 't']

export interface TierInfo {
  /** What the player reads instead of the rarity name. */
  label: string
  /** Plain rarity name, used for screen readers and in the question file format. */
  rarity: string
  points: number
}

export const TIER_INFO: Record<Outcome, TierInfo> = {
  miss: { label: 'morto di CACCA ADDOSSO !', rarity: 'Miss', points: 0 },
  c: { label: 'bada che storia', rarity: 'Comune', points: 10 },
  n: { label: 'parata col petto', rarity: 'Non comune', points: 25 },
  r: { label: 'Shave like a Bomber!', rarity: 'Raro', points: 50 },
  e: { label: 'Jonny 🍆', rarity: 'Esclusivo', points: 75 },
  t: { label: 'Marco B.', rarity: 'Farflung', points: 100 },
}

/**
 * Questions in a game at most, in proportion to the points of the world: one every 25 points in
 * hardcore (20 for 500 points … 60 for 1500), a quarter fewer without hardcore (15 … 45). After the
 * last one the game ends, arrival or not.
 */
export function maxQuestions(target: number, hardcore = true): number {
  return Math.round((target / 25) * (hardcore ? 1 : 0.75))
}

/** «Cambia domanda»: the same in every world. */
export const SWAPS = 5

/** The rarities a game can end on, from the bottom of the meter: without hardcore there is no miss. */
export function ladderFor(hardcore: boolean): readonly Outcome[] {
  return hardcore ? OUTCOMES : OUTCOMES.filter((outcome) => outcome !== 'miss')
}

/** Four stops along the trail, one every fifth of the way: where the steps of a world change. */
export function stopsFor(target: number): number[] {
  return [1, 2, 3, 4].map((k) => (target * k) / 5)
}

/** Which of the five steps of a world a score is in: 0 … 4. The arrival itself is reached at the goal. */
export function stepOf(score: number, goal: number): number {
  return Math.max(0, Math.min(4, Math.floor(score / (goal / 5))))
}
