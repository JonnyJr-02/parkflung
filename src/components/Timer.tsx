import { useEffect, useRef, useState } from 'react'
import { sfx } from '../game/sound'
import { formatClock, timerLevel } from '../game/timer'

const RADIUS = 19
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * The countdown for one question, pinned to the top-right corner so it stays in sight during the
 * whole game, overlays included. It only runs while `running`; give it a new `key` for each question.
 */
export function Timer({ seconds, running, onExpire }: { seconds: number; running: boolean; onExpire: () => void }) {
  const total = seconds * 1000
  const [left, setLeft] = useState(total)
  const leftRef = useRef(total)
  const expireRef = useRef(onExpire)
  expireRef.current = onExpire

  useEffect(() => {
    if (!running || leftRef.current <= 0) return
    // Measured against the clock, not counted in ticks, so a phone that sleeps or lags stays fair.
    const deadline = Date.now() + leftRef.current
    const id = window.setInterval(() => {
      const now = Math.max(0, deadline - Date.now())
      leftRef.current = now
      setLeft(now)
      if (now <= 0) {
        window.clearInterval(id)
        sfx.buzzer()
        expireRef.current()
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [running])

  const level = timerLevel(left, total)
  const wholeSeconds = Math.max(0, Math.ceil(left / 1000))

  // A tick for each of the last five seconds.
  useEffect(() => {
    if (running && wholeSeconds > 0 && wholeSeconds <= 5 && wholeSeconds * 1000 < total) sfx.clock(wholeSeconds)
  }, [wholeSeconds, running, total])
  return (
    <div
      className={`timer ${level}${running ? '' : ' paused'}`}
      role="timer"
      aria-label={running ? `Tempo rimasto: ${wholeSeconds} secondi` : `Timer in pausa: ${wholeSeconds} secondi`}
    >
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="timer-track" cx="22" cy="22" r={RADIUS} />
        <circle
          className="timer-ring"
          cx="22"
          cy="22"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - left / total)}
        />
      </svg>
      <span className="timer-text" aria-hidden="true">
        {formatClock(left)}
      </span>
    </div>
  )
}
