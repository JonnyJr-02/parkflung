/** Seconds a player can choose for each question in Impostazioni. */
export const TIMER_CHOICES = [15, 30, 45, 60] as const
export type TimerSeconds = (typeof TIMER_CHOICES)[number]
export const DEFAULT_TIMER: TimerSeconds = 30

export type TimerLevel = 'green' | 'yellow' | 'orange' | 'red'

export function isTimerSeconds(value: unknown): value is TimerSeconds {
  return TIMER_CHOICES.includes(value as TimerSeconds)
}

/** Green for the first half, then yellow, orange and, for the last 15%, red. */
export function timerLevel(remainingMs: number, totalMs: number): TimerLevel {
  const left = totalMs > 0 ? remainingMs / totalMs : 0
  if (left > 0.5) return 'green'
  if (left > 0.3) return 'yellow'
  if (left > 0.15) return 'orange'
  return 'red'
}

/** "0:30", "4:59": whole seconds, rounded up so the clock shows 0:00 only when time is over. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** "15 s", "30 s", "45 s", "60 s". */
export function timerLabel(seconds: number): string {
  return `${seconds} s`
}
