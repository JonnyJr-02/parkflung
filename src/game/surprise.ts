import { maxQuestions } from './tiers'
import type { WheelKind } from './worlds'

/** What a wheel of fortune can give at a "?" square. */
export type Prize =
  | 'goal-up'
  | 'goal-up-200'
  | 'questions-up'
  | 'card'
  | 'diamond'
  | 'questions-down'
  | 'questions-down-5'
  | 'goal-down'

export interface PrizeInfo {
  id: Prize
  /** Malus in red, bonus in blue, the Carta Rivincita in gold, the Carta Diamante in light blue. */
  kind: 'malus' | 'bonus' | 'gold' | 'diamond'
  /** Big and small text on the wheel; «|» breaks the small text in two lines. */
  big: string
  small: string
  title: string
  /** Points added to the arrival (a malus) or taken away (a bonus). */
  goal?: number
  /** Questions added to the game (a bonus) or taken away (a malus). */
  questions?: number
}

export const PRIZE_INFO: Record<Prize, PrizeInfo> = {
  'goal-up': { id: 'goal-up', kind: 'malus', big: '+100', small: 'al traguardo', title: '+100 punti al traguardo', goal: 100 },
  'goal-up-200': { id: 'goal-up-200', kind: 'malus', big: '+200', small: 'al traguardo', title: '+200 punti al traguardo', goal: 200 },
  'questions-down': { id: 'questions-down', kind: 'malus', big: '−3', small: 'domande', title: '−3 domande', questions: -3 },
  'questions-down-5': { id: 'questions-down-5', kind: 'malus', big: '−5', small: 'domande', title: '−5 domande', questions: -5 },
  'questions-up': { id: 'questions-up', kind: 'bonus', big: '+3', small: 'domande', title: '+3 domande', questions: 3 },
  'goal-down': { id: 'goal-down', kind: 'bonus', big: '−100', small: 'al traguardo', title: '−100 punti al traguardo', goal: -100 },
  card: { id: 'card', kind: 'gold', big: '🃏', small: 'Carta|Rivincita', title: 'Carta Rivincita' },
  diamond: { id: 'diamond', kind: 'diamond', big: '💎', small: 'Carta|Diamante', title: 'Carta Diamante' },
}

/** The slices of each wheel, clockwise from the top: reds, blues and the cards spread out. */
export const WHEELS: Record<WheelKind, readonly Prize[]> = {
  // 2 bonus, 2 malus and the Carta Rivincita.
  classic: ['goal-up', 'questions-up', 'card', 'questions-down', 'goal-down'],
  // 4 malus: no way out.
  malus: ['goal-up', 'questions-down', 'goal-up-200', 'questions-down-5'],
  // 4 malus and the Carta Rivincita.
  'malus-gold': ['goal-up', 'questions-down', 'card', 'goal-up-200', 'questions-down-5'],
  // 4 malus and the Carta Diamante.
  'malus-diamond': ['goal-up', 'questions-down', 'diamond', 'goal-up-200', 'questions-down-5'],
}

export function isPrize(value: unknown): value is Prize {
  return typeof value === 'string' && value in PRIZE_INFO
}

export function prizeInfo(prize: Prize): PrizeInfo {
  return PRIZE_INFO[prize]
}

/** One of the slices of a wheel, each as likely as the others. */
export function spinPrize(wheel: WheelKind, random: () => number = Math.random): Prize {
  const slices = WHEELS[wheel]
  return slices[Math.min(slices.length - 1, Math.floor(random() * slices.length))]!
}

/**
 * The "?" squares met so far in a game, by their place in the world's list: the prize, or null
 * when the square was skipped. Squares not met yet are missing.
 */
export type Met = Partial<Record<number, Prize | null>>

export interface Rules {
  /** Points to reach the arrival. */
  goal: number
  /** Questions in the game at most. */
  limit: number
  /** The Carta Rivincita: after the lowest rarity, the same question can be answered once more. */
  card: boolean
  /** The Carta Diamante: every answer is worth double points. */
  diamond: boolean
}

/** The rules of a game: the arrival at `target` in one question every 25 points, changed by the wheels. */
export function rulesFor(target: number, met: Met = {}, hardcore = true): Rules {
  const prizes = Object.values(met).filter((prize): prize is Prize => !!prize)
  return {
    goal: target + prizes.reduce((sum, prize) => sum + (PRIZE_INFO[prize].goal ?? 0), 0),
    limit: maxQuestions(target, hardcore) + prizes.reduce((sum, prize) => sum + (PRIZE_INFO[prize].questions ?? 0), 0),
    card: prizes.includes('card'),
    diamond: prizes.includes('diamond'),
  }
}

/** The rarity the Carta Rivincita lets you answer again after: the lowest one the game has. */
export function cardLabel(hardcore: boolean): string {
  return hardcore ? '«morto di CACCA ADDOSSO !»' : '«bada che storia»'
}

/** What the prize means now, in one sentence, given the rules once it is counted. */
export function prizeNote(prize: Prize, rules: Rules, hardcore = true): string {
  const info = PRIZE_INFO[prize]
  if (info.goal) return `Ora il traguardo è a ${rules.goal} punti.`
  if (info.questions) return `Ora la partita ha ${rules.limit} domande in tutto.`
  if (prize === 'diamond') return 'Per tutta la partita ogni risposta vale il doppio dei punti.'
  return `Per tutta la partita: se fai ${cardLabel(hardcore)} puoi rispondere di nuovo alla stessa domanda, una volta per domanda.`
}
