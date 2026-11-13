import { useEffect, useMemo, useRef, useState } from 'react'
import { OUTCOMES, TIER_INFO, type Outcome } from '../game/tiers'

/** Height of one reel row, in CSS pixels (matches .slot-row in styles.css). */
const ROW = 64
/** Full turns of the reel before it lands. */
const LOOPS = 4
const LEVER_MS = 520
/** The rarer the answer, the longer the reel spins and the further it slips past before settling. */
const SPIN_MS: Record<Outcome, number> = { miss: 3200, c: 3800, n: 4600, r: 5400, e: 6400, t: 7600 }
const OVERSHOOT: Record<Outcome, number> = { miss: 0.12, c: 0.12, n: 0.18, r: 0.3, e: 0.38, t: 0.45 }
const SETTLE_MS = 450
const HOLD_MS = 1100

/** Total time from the lever pull to `onDone`. */
export function spinMs(outcome: Outcome): number {
  return LEVER_MS + SPIN_MS[outcome] + SETTLE_MS + HOLD_MS
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

let lastBuzz = 0
function tick(now: number) {
  if (now - lastBuzz < 70) return
  lastBuzz = now
  try {
    navigator.vibrate?.(4)
  } catch {
    // Haptics are a bonus.
  }
}

/**
 * Slot machine: the lever drops, the reel spins through every rarity, slows down and stops on the
 * answer's tier with a little slip past the line and back. Then the winning row lights up.
 */
export function SlotReveal({ outcome, typed, onDone }: { outcome: Outcome; typed: string; onDone: () => void }) {
  const target = LOOPS * OUTCOMES.length + OUTCOMES.indexOf(outcome)
  const rows = useMemo(() => Array.from({ length: target + 3 }, (_, n) => OUTCOMES[n % OUTCOMES.length]!), [target])
  const reelRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<'lever' | 'spinning' | 'won'>('lever')
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const reel = reelRef.current
    const show = (pos: number) => reel?.style.setProperty('transform', `translate3d(0, ${((1 - pos) * ROW).toFixed(2)}px, 0)`)
    const timers: number[] = []
    let frame = 0
    show(0)
    if (prefersReducedMotion()) {
      show(target)
      setStage('won')
      timers.push(window.setTimeout(() => doneRef.current(), 900))
      return () => timers.forEach(clearTimeout)
    }
    const spin = SPIN_MS[outcome]
    const far = target + OVERSHOOT[outcome]
    let lastRow = 0
    timers.push(
      window.setTimeout(() => {
        setStage('spinning')
        const start = performance.now()
        const run = (now: number) => {
          const elapsed = now - start
          let pos: number
          if (elapsed < spin) {
            const t = elapsed / spin
            pos = far * (1 - Math.pow(1 - t, 4))
          } else {
            const t = Math.min(1, (elapsed - spin) / SETTLE_MS)
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            pos = far + (target - far) * eased
          }
          show(pos)
          const row = Math.round(pos)
          if (row !== lastRow) {
            lastRow = row
            tick(now)
          }
          if (elapsed < spin + SETTLE_MS) frame = requestAnimationFrame(run)
          else {
            setStage('won')
            timers.push(window.setTimeout(() => doneRef.current(), HOLD_MS))
          }
        }
        frame = requestAnimationFrame(run)
      }, LEVER_MS),
    )
    return () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(frame)
    }
  }, [outcome, target])

  return (
    <section className={`slot slot-${stage} tier-${outcome}`} aria-live="polite">
      <p className="slot-kicker">Hai detto</p>
      <p className="slot-answer">{typed ? `«${typed}»` : 'niente…'}</p>
      <div className="slot-machine">
        <div className="slot-sign">Quanto è rara?</div>
        <div className="slot-bulbs" aria-hidden="true">
          {Array.from({ length: 9 }, (_, n) => (
            <span key={n} className="bulb" />
          ))}
        </div>
        <div className="slot-window">
          <div className="slot-reel" ref={reelRef} aria-hidden="true">
            {rows.map((tier, n) => (
              <div key={n} className={`slot-row tier-${tier}${stage === 'won' && n === target ? ' win' : ''}`}>
                <span className="slot-label">{TIER_INFO[tier].label}</span>
                <span className="slot-points">{TIER_INFO[tier].points}</span>
              </div>
            ))}
          </div>
          <div className="slot-payline" aria-hidden="true" />
        </div>
        <div className="slot-bulbs" aria-hidden="true">
          {Array.from({ length: 9 }, (_, n) => (
            <span key={n} className="bulb" />
          ))}
        </div>
        <div className="slot-lever" aria-hidden="true">
          <span className="slot-lever-arm" />
        </div>
        <p className="sr-only">{stage === 'won' ? TIER_INFO[outcome].label : 'Il rullo gira…'}</p>
      </div>
    </section>
  )
}
