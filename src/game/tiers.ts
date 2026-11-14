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

/** Points needed to reach the house of Ale: chosen in Impostazioni. */
export const TARGETS = [500, 1000] as const
export type Target = (typeof TARGETS)[number]
export const DEFAULT_TARGET: Target = 500
export const MAX_SCORE: Target = DEFAULT_TARGET

export function isTarget(value: unknown): value is Target {
  return TARGETS.includes(value as Target)
}

/** Four stops between the cart and the house, one every fifth of the way: 100…400, or 200…800. */
export function stopsFor(target: number): number[] {
  return [1, 2, 3, 4].map((k) => (target * k) / 5)
}

/** Kept for the 500-point trail drawn on the home poster. */
export const STOPS: readonly number[] = stopsFor(DEFAULT_TARGET)

/** How many stops a score has reached: 0 at the cart, 5 at the house. */
export function stopsReached(score: number, target: number = DEFAULT_TARGET): number {
  if (score >= target) return 5
  return stopsFor(target).filter((stop) => score >= stop).length
}

/** The weather along the trail: a world for each fifth of the way, from the storm to the sunset. */
export const WORLDS = [
  { name: 'Temporale', icon: '⛈️', note: 'pioggia e fulmini' },
  { name: 'Pioggerella', icon: '🌧️', note: 'pioviggina' },
  { name: 'Nuvole e sole', icon: '⛅', note: "un po' nuvoloso, ma spunta il sole" },
  { name: 'Sole', icon: '☀️', note: 'cielo sereno' },
  { name: 'Tramonto', icon: '🌅', note: 'un tramonto bellissimo sul mare' },
] as const

/** Which world a score is in: 0 (storm) … 4 (sunset). The house itself is reached at the target. */
export function worldOf(score: number, target: number = DEFAULT_TARGET): number {
  return Math.max(0, Math.min(4, Math.floor(score / (target / 5))))
}
