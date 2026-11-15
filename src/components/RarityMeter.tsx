import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { sfx } from '../game/sound'
import { OUTCOMES, TIER_INFO, type Outcome } from '../game/tiers'

/** One rung of the ladder: pill height plus the gap, in CSS pixels (matches .meter-step). */
const RUNG = 52
const PILL = 46
const INTRO_MS = 520
/** The rarer the answer, the longer the climb (same timings as the slot machine had). */
const CLIMB_MS: Record<Outcome, number> = { miss: 3200, c: 3800, n: 4600, r: 5400, e: 6400, t: 7600 }
/** How far the bar creeps past the answer's rung before falling back: it teases the next one. */
const TEASE: Record<Outcome, number> = { miss: 0.85, c: 0.35, n: 0.4, r: 0.45, e: 0.5, t: 0.4 }
/** Where the bar creeps to, in the bulb under the ladder, before pushing on to the bottom rung. */
const BELOW_MISS = 0.3
const SETTLE_MS = 450
const HOLD_MS = 1100

/** Time from the start to `onDone` when the bar falls back onto the answer (the other ending is a step shorter). */
export function revealMs(outcome: Outcome): number {
  return INTRO_MS + CLIMB_MS[outcome] + SETTLE_MS + HOLD_MS
}

/**
 * How the reveal ends: true when the bar waits a rung below and then pushes on up to the answer,
 * false when it creeps towards the rung above and falls back onto the answer. Half and half for
 * every rarity, a miss included; Marco B. has nothing above, so it always goes up.
 */
export function pushesOn(outcome: Outcome, random: () => number = Math.random): boolean {
  return outcome === 't' || random() < 0.5
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // Haptics are a bonus.
  }
}

/**
 * The rarities light up from the bottom while a thermometer beside them fills up, slower and
 * slower; at the end the rung above flickers and the bar either falls back or pushes on to it.
 * Level 0 is the bottom of the ladder; rung i has its centre at i + 0.5. In hardcore the ladder
 * starts with the miss; without hardcore there is no miss and it starts with «bada che storia».
 */
export function RarityMeter({
  outcome,
  typed,
  ladder = OUTCOMES,
  onDone,
}: {
  outcome: Outcome
  typed: string
  ladder?: readonly Outcome[]
  onDone: () => void
}) {
  const target = Math.max(0, ladder.indexOf(outcome))
  /** The miss rung lights only when it is the answer; any other bottom rung lights as the bar passes it. */
  const missAtBottom = ladder[0] === 'miss'
  const [lit, setLit] = useState(0)
  const [bottomLit, setBottomLit] = useState(false)
  const [tease, setTease] = useState(-1)
  const [done, setDone] = useState(false)
  const fillRef = useRef<HTMLSpanElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const height = ladder.length * RUNG - (RUNG - PILL)

  useEffect(() => {
    const timers: number[] = []
    let frame = 0
    const show = (level: number) => {
      const px = Math.max(0, level * RUNG - (RUNG - PILL) / 2)
      fillRef.current?.style.setProperty('transform', `translateY(${(height - px).toFixed(1)}px)`)
    }
    show(0)
    let stopRoll = () => {}
    const finish = () => {
      stopRoll()
      sfx.rarity(outcome)
      setTease(-1)
      setDone(true)
      buzz(outcome === 'miss' ? 60 : 30)
      timers.push(window.setTimeout(() => doneRef.current(), HOLD_MS))
    }
    if (prefersReducedMotion()) {
      show(target + 0.5)
      setLit(target)
      if (!missAtBottom) setBottomLit(true)
      finish()
      return () => timers.forEach(clearTimeout)
    }
    // Two endings that look the same until the very last moment: the bar pauses on a rung and the
    // one above flickers. Either it falls back (the answer is the paused rung) or it pushes on and
    // the flickering rung lights up (the answer is that one). Half and half: for a miss going up,
    // the bar waits low in the bulb while the miss flickers, then rises onto it.
    const pushOn = pushesOn(outcome)
    const apparent: Outcome | undefined = pushOn ? ladder[target - 1] : outcome
    const goal = target + 0.5
    const pause = pushOn ? goal - 1 : goal
    const far = apparent ? pause + TEASE[apparent] : BELOW_MISS
    const teaseRung = pushOn ? target : target + 1
    // The climb is timed for the rung where the bar pauses, so its speed gives nothing away.
    const climb = CLIMB_MS[apparent ?? ladder[0]!]
    let shown = 0
    let bottomHeard = false
    let settled = false
    timers.push(
      window.setTimeout(() => {
        stopRoll = sfx.roll()
        const start = performance.now()
        const run = (now: number) => {
          const elapsed = now - start
          let level: number
          if (elapsed < climb) {
            const t = elapsed / climb
            level = far * (1 - Math.pow(1 - t, 4))
          } else {
            if (!settled) {
              // The moment of truth: the bar pushes on, or falls back.
              settled = true
              stopRoll()
              if (pushOn) sfx.up()
              else sfx.down()
            }
            const t = Math.min(1, (elapsed - climb) / SETTLE_MS)
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            level = far + (goal - far) * eased
          }
          show(level)
          // Rungs light up as the bar reaches their middle and stay lit (the miss only if it is the answer).
          if (!missAtBottom && level >= 0.5) {
            setBottomLit(true)
            if (!bottomHeard) sfx.rung(0)
            bottomHeard = true
          }
          const reached = Math.min(target, Math.max(0, Math.floor(level - 0.5)))
          if (reached > shown) {
            shown = reached
            setLit(reached)
            sfx.rung(reached)
            buzz(8)
          }
          // The rung above the pause flickers while the bar creeps towards it.
          setTease(elapsed < climb && level > Math.max(0.1, pause + 0.15) && teaseRung < ladder.length ? teaseRung : -1)
          if (elapsed < climb + SETTLE_MS) frame = requestAnimationFrame(run)
          else finish()
        }
        frame = requestAnimationFrame(run)
      }, INTRO_MS),
    )
    return () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(frame)
      stopRoll()
    }
  }, [outcome, target, height, ladder, missAtBottom])

  const fillClass = done ? `tier-${outcome}` : lit > 0 ? `tier-${ladder[lit]}` : bottomLit ? `tier-${ladder[0]}` : 'idle'

  return (
    <section className={`meter${done ? ' done' : ''}`} aria-live="polite">
      <p className="meter-kicker">Hai detto</p>
      <p className="meter-answer">{typed ? `«${typed}»` : 'niente…'}</p>
      <p className="meter-title">
        {done ? TIER_INFO[outcome].label : 'Quanto è rara'}
        {!done && (
          <span className="meter-dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        )}
      </p>
      <div className="meter-body" style={{ '--h': `${height}px` } as CSSProperties}>
        <ol className="meter-steps">
          {ladder.map((tier, index) => {
            const on = index === 0 ? (missAtBottom ? done && outcome === tier : bottomLit) : index <= lit
            const state = on ? 'on' : tease === index ? 'tease' : 'off'
            return (
              <li key={tier} className={`meter-step tier-${tier} ${state}${done && tier === outcome ? ' win' : ''}`}>
                <span className="meter-label">{TIER_INFO[tier].label}</span>
                <span className="meter-points">{TIER_INFO[tier].points}</span>
              </li>
            )
          })}
        </ol>
        <div className={`thermo ${fillClass}`} aria-hidden="true">
          <span className="thermo-tube">
            <span className="thermo-fill" ref={fillRef} />
            {ladder.map((tier, index) => (
              <span key={tier} className="thermo-tick" style={{ bottom: `${index * RUNG + PILL / 2}px` }} />
            ))}
          </span>
          <span className="thermo-bulb" />
        </div>
      </div>
    </section>
  )
}
