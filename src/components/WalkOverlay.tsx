import { useEffect, useRef, useState } from 'react'
import { MAX_SCORE, STOPS, TIER_INFO, type Outcome } from '../game/tiers'
import { Scene } from './Scene'

/**
 * Full-screen walk after each scoring answer: the whole trail, the camera closes in on the walker,
 * follows him to his new place, then pulls back. Tap anywhere to skip ahead.
 */
export function WalkOverlay({ from, to, outcome, onDone }: { from: number; to: number; outcome: Outcome; onDone: () => void }) {
  const [points, setPoints] = useState(from)
  const [arrived, setArrived] = useState(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const finished = useRef(false)
  const passed = STOPS.filter((stop) => from < stop && to >= stop)
  const milestone =
    to >= MAX_SCORE && from < MAX_SCORE
      ? 'Sei arrivato alla casa di Ale a Varigotti!'
      : passed.length > 0
        ? `Tappa ${STOPS.indexOf(passed[passed.length - 1]!) + 1} superata!`
        : null

  function finish() {
    if (finished.current) return
    finished.current = true
    doneRef.current()
  }

  useEffect(() => {
    const start = window.setTimeout(() => setPoints(to), 450)
    return () => clearTimeout(start)
  }, [to])

  useEffect(() => {
    if (!arrived) return
    const end = window.setTimeout(finish, 2200)
    return () => clearTimeout(end)
  }, [arrived])

  return (
    <div className="walk" role="dialog" aria-modal="true" aria-label={`L'omino cammina fino a ${to} punti`} onClick={finish}>
      <Scene className="walk-scene" points={points} camera msPer100={1300} label={`Il sentiero: ${to} punti su ${MAX_SCORE}`} onArrive={() => setArrived(true)} />
      <div className={`walk-top tier-${outcome}`}>
        <span className="chip">{TIER_INFO[outcome].label}</span>
        <span className="walk-gain">+{to - from}</span>
      </div>
      <div className={`walk-bottom ${arrived ? 'show' : ''}`}>
        <p className="walk-total">
          <strong>{to}</strong> / {MAX_SCORE}
        </p>
        {milestone && <p className="walk-stop">{milestone}</p>}
        <p className="walk-hint">Tocca per continuare</p>
      </div>
    </div>
  )
}
