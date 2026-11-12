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

export const QUESTIONS_PER_GAME = 5
export const MAX_SCORE = QUESTIONS_PER_GAME * TIER_INFO.t.points
/** Intermediate stops along the trail, evenly spaced between the cart (0) and the house (MAX_SCORE). */
export const STOPS: readonly number[] = [100, 200, 300, 400]

/** How many stops a score has reached: 0 at the cart, STOPS.length + 1 at the yellow house. */
export function stopsReached(score: number): number {
  if (score >= MAX_SCORE) return STOPS.length + 1
  return STOPS.filter((stop) => score >= stop).length
}
