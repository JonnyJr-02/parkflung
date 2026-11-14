import { maxQuestions } from './tiers'

/** What the wheel of fortune can give at the "?" square. */
export type Prize = 'goal-up' | 'questions-up' | 'card' | 'questions-down' | 'goal-down'

export interface PrizeInfo {
  id: Prize
  /** Malus in red, bonus in blue, the card in gold. */
  kind: 'malus' | 'bonus' | 'gold'
  /** Big and small text on the wheel. */
  big: string
  small: string
  title: string
}

/** The five slices of the wheel, clockwise from the top: reds, blues and the gold card spread out. */
export const PRIZES: readonly PrizeInfo[] = [
  { id: 'goal-up', kind: 'malus', big: '+100', small: 'al traguardo', title: '+100 punti al traguardo' },
  { id: 'questions-up', kind: 'bonus', big: '+3', small: 'domande', title: '+3 domande' },
  { id: 'card', kind: 'gold', big: '🃏', small: 'Carta|Rivincita', title: 'Carta Rivincita' },
  { id: 'questions-down', kind: 'malus', big: '−3', small: 'domande', title: '−3 domande' },
  { id: 'goal-down', kind: 'bonus', big: '−100', small: 'al traguardo', title: '−100 punti al traguardo' },
]

/** The "?" square: skipped (no prize) or the prize the wheel gave. Missing until the walker gets there. */
export interface Surprise {
  prize: Prize | null
}

export function isPrize(value: unknown): value is Prize {
  return PRIZES.some((prize) => prize.id === value)
}

export function prizeInfo(prize: Prize): PrizeInfo {
  return PRIZES.find((item) => item.id === prize)!
}

/** The "?" square is exactly halfway: 250 points out of 500, 500 out of 1000. */
export function halfway(target: number): number {
  return target / 2
}

/** One of the five slices, each as likely as the others. */
export function spinPrize(random: () => number = Math.random): Prize {
  return PRIZES[Math.min(PRIZES.length - 1, Math.floor(random() * PRIZES.length))]!.id
}

export interface Rules {
  /** Points to reach the house. */
  goal: number
  /** Questions in the game at most. */
  limit: number
  /** The Carta Rivincita: after a miss, the same question can be answered once more. */
  card: boolean
}

/** The rules of a game: the house at `target` in 20 or 40 questions, changed by the wheel. */
export function rulesFor(target: number, surprise?: Surprise | null): Rules {
  const prize = surprise?.prize ?? null
  return {
    goal: target + (prize === 'goal-up' ? 100 : prize === 'goal-down' ? -100 : 0),
    limit: maxQuestions(target) + (prize === 'questions-up' ? 3 : prize === 'questions-down' ? -3 : 0),
    card: prize === 'card',
  }
}

/** What the prize means now, in one sentence. */
export function prizeNote(prize: Prize, target: number): string {
  const { goal, limit } = rulesFor(target, { prize })
  switch (prize) {
    case 'goal-up':
    case 'goal-down':
      return `Ora la casa di Ale è a ${goal} punti.`
    case 'questions-up':
    case 'questions-down':
      return `Ora la partita ha ${limit} domande in tutto.`
    case 'card':
      return 'Per tutta la partita: se fai «morto di CACCA ADDOSSO !» puoi rispondere di nuovo alla stessa domanda, una volta per domanda.'
  }
}
