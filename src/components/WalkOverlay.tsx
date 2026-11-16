import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { stepOf, stopsFor, TIER_INFO, type Outcome } from '../game/tiers'
import type { WorldInfo } from '../game/worlds'
import { Scene } from './Scene'

/**
 * Full-screen walk after each scoring answer: the whole trail in view, the walker strides to his
 * new place and the walked part of the trail fills with colour. When he walks into a new step the
 * sky changes once he gets there. Tap anywhere to skip ahead.
 */
export function WalkOverlay({
  world,
  from,
  to,
  goal,
  outcome,
  spots,
  onDone,
}: {
  world: WorldInfo
  from: number
  to: number
  goal: number
  outcome: Outcome
  /** The "?" squares of the world, and whether each was already met. */
  spots: ReadonlyArray<{ at: number; used: boolean }>
  onDone: () => void
}) {
  const [points, setPoints] = useState(from)
  const [arrived, setArrived] = useState(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const finished = useRef(false)
  const shownTo = Math.min(to, goal)
  const stepFrom = stepOf(from, goal)
  const stepTo = stepOf(shownTo, goal)
  const step = world.steps[arrived ? stepTo : stepFrom]!
  const stops = stopsFor(goal)
  const passed = stops.filter((stop) => from < stop && to >= stop)
  const newStep = stepTo > stepFrom && to < goal
  const square = spots.some((spot) => !spot.used && from < spot.at && to >= spot.at)
  const milestone =
    to >= goal && from < goal
      ? world.arrival.title
      : newStep
        ? `Nuovo step: ${world.steps[stepTo]!.icon} ${world.steps[stepTo]!.name}!`
        : square
          ? 'Casella imprevisti ?'
          : passed.length > 0
            ? `Tappa ${stops.indexOf(passed[passed.length - 1]!) + 1} superata!`
            : null

  // How much of the bottom the score panel covers: on a tall phone the trail stays above it.
  const walkRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [clear, setClear] = useState(0)
  useLayoutEffect(() => {
    const walk = walkRef.current
    const panel = panelRef.current
    if (!walk || !panel) return
    // offsetTop ignores the panel's slide-in transform: this is where it ends up.
    setClear(Math.max(0, walk.clientHeight - panel.offsetTop + 8))
  }, [milestone])

  function finish() {
    if (finished.current) return
    finished.current = true
    doneRef.current()
  }

  useEffect(() => {
    const start = window.setTimeout(() => setPoints(shownTo), 450)
    return () => clearTimeout(start)
  }, [shownTo])

  useEffect(() => {
    if (!arrived) return
    // A new step gets a little longer, to enjoy the new sky.
    const end = window.setTimeout(finish, newStep ? 3400 : 2200)
    return () => clearTimeout(end)
  }, [arrived])

  return (
    <div ref={walkRef} className="walk" role="dialog" aria-modal="true" aria-label={`L'omino cammina fino a ${shownTo} punti`} onClick={finish}>
      <Scene
        className="walk-scene"
        clearBottom={clear}
        world={world.id}
        sky={step.sky}
        wobble={step.wobble}
        walker={world.walker}
        points={points}
        target={goal}
        msPer100={3000 * (500 / goal)}
        spots={spots}
        label={`Il sentiero: ${shownTo} punti su ${goal}`}
        onArrive={() => setArrived(true)}
      />
      <div className={`walk-top tier-${outcome}`}>
        <span className="chip">{TIER_INFO[outcome].label}</span>
        <span className="walk-gain">+{to - from}</span>
      </div>
      <div ref={panelRef} className={`walk-bottom ${arrived ? 'show' : ''}`}>
        <p className="walk-total">
          <strong>{shownTo}</strong> / {goal}
        </p>
        {milestone && <p className={newStep ? 'walk-stop new-world' : 'walk-stop'}>{milestone}</p>}
        <p className="walk-hint">Tocca per continuare</p>
      </div>
    </div>
  )
}
