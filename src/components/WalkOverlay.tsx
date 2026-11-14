import { useEffect, useRef, useState } from 'react'
import { stopsFor, TIER_INFO, worldOf, WORLDS, type Outcome } from '../game/tiers'
import { Scene } from './Scene'

/**
 * Full-screen walk after each scoring answer: the whole trail in view, the walker strides to his
 * new place and the walked part of the trail fills with colour. When he walks into a new world
 * the weather changes once he gets there. Tap anywhere to skip ahead.
 */
export function WalkOverlay({
  from,
  to,
  target,
  outcome,
  surprise,
  onDone,
}: {
  from: number
  to: number
  target: number
  outcome: Outcome
  /** The "?" square halfway, and whether it was already met. */
  surprise?: { at: number; used: boolean }
  onDone: () => void
}) {
  const [points, setPoints] = useState(from)
  const [arrived, setArrived] = useState(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const finished = useRef(false)
  const shownTo = Math.min(to, target)
  const worldFrom = worldOf(from, target)
  const worldTo = worldOf(shownTo, target)
  const stops = stopsFor(target)
  const passed = stops.filter((stop) => from < stop && to >= stop)
  const milestone =
    to >= target && from < target
      ? 'Sei arrivato alla casa di Ale a Varigotti!'
      : worldTo > worldFrom
        ? `Nuovo mondo: ${WORLDS[worldTo]!.icon} ${WORLDS[worldTo]!.name}!`
        : surprise && !surprise.used && from < surprise.at && to >= surprise.at
          ? 'Casella imprevisti ?'
          : passed.length > 0
          ? `Tappa ${stops.indexOf(passed[passed.length - 1]!) + 1} superata!`
          : null

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
    // A new world gets a little longer, to enjoy the new weather.
    const end = window.setTimeout(finish, worldTo > worldFrom ? 3400 : 2200)
    return () => clearTimeout(end)
  }, [arrived])

  return (
    <div className="walk" role="dialog" aria-modal="true" aria-label={`L'omino cammina fino a ${shownTo} punti`} onClick={finish}>
      <Scene
        className="walk-scene"
        points={points}
        target={target}
        world={arrived ? worldTo : worldFrom}
        msPer100={3000 * (500 / target)}
        surprise={surprise}
        label={`Il sentiero: ${shownTo} punti su ${target}`}
        onArrive={() => setArrived(true)}
      />
      <div className={`walk-top tier-${outcome}`}>
        <span className="chip">{TIER_INFO[outcome].label}</span>
        <span className="walk-gain">+{to - from}</span>
      </div>
      <div className={`walk-bottom ${arrived ? 'show' : ''}`}>
        <p className="walk-total">
          <strong>{shownTo}</strong> / {target}
        </p>
        {milestone && <p className={worldTo > worldFrom ? 'walk-stop new-world' : 'walk-stop'}>{milestone}</p>}
        <p className="walk-hint">Tocca per continuare</p>
      </div>
    </div>
  )
}
