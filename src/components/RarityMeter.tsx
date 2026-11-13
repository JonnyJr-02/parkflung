import { useEffect, useState } from 'react'
import { TIER_INFO, TIERS, type Outcome } from '../game/tiers'

/** How long each tier stays lit before the next one: the climb slows down as it gets rarer. */
const STEP_MS = [450, 560, 700, 860, 1050] as const
const INTRO_MS = 600
const TEASE_MS = 420
const HOLD_MS = 320

/** Total suspense for an outcome, used by tests and to keep the timings in one place. */
export function suspenseMs(outcome: Outcome): number {
  const steps = outcome === 'miss' ? 0 : TIERS.indexOf(outcome) + 1
  const climb = STEP_MS.slice(0, steps).reduce((sum, ms) => sum + ms, 0)
  return INTRO_MS + climb + (steps < TIERS.length ? TEASE_MS : 0) + HOLD_MS
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function tick() {
  try {
    navigator.vibrate?.(10)
  } catch {
    // Haptics are a bonus.
  }
}

/**
 * Suspense before the rarity is revealed: the tiers light up one by one from the commonest,
 * slowing down as they climb, and stop on the answer's tier. The next tier flickers once as if
 * it might light too, then the meter settles and `onDone` fires.
 */
export function RarityMeter({ outcome, typed, onDone }: { outcome: Outcome; typed: string; onDone: () => void }) {
  const steps = outcome === 'miss' ? 0 : TIERS.indexOf(outcome) + 1
  const [lit, setLit] = useState(0)
  const [tease, setTease] = useState(false)

  useEffect(() => {
    const timers: number[] = []
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))
    if (prefersReducedMotion()) {
      setLit(steps)
      at(400, onDone)
      return () => timers.forEach(clearTimeout)
    }
    let time = INTRO_MS
    for (let step = 1; step <= steps; step++) {
      at(time, () => {
        setLit(step)
        tick()
      })
      time += STEP_MS[step - 1]!
    }
    if (steps < TIERS.length) {
      at(time - 120, () => setTease(true))
      time += TEASE_MS
      at(time - 120, () => setTease(false))
    }
    at(time + HOLD_MS, onDone)
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <section className="meter" aria-live="polite" aria-label="Sto calcolando la rarità della risposta">
      <p className="meter-kicker">Hai detto</p>
      <p className="meter-answer">{typed ? `«${typed}»` : 'niente…'}</p>
      <p className="meter-title">
        Quanto è rara<span className="meter-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
      </p>
      <ol className="meter-steps">
        {TIERS.map((tier, index) => {
          const state = index < lit ? 'on' : tease && index === lit ? 'tease' : 'off'
          return (
            <li key={tier} className={`meter-step tier-${tier} ${state}`}>
              <span className="meter-label">{TIER_INFO[tier].label}</span>
              <span className="meter-points">{TIER_INFO[tier].points}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
