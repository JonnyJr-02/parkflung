import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { sfx } from '../game/sound'
import { WORLDS } from '../game/worlds'
import { prefersReducedMotion, startShow } from './Finale'

/** Who did what. */
export const CREDITS: ReadonlyArray<{ role: string; name: string }> = [
  { role: 'Creato da', name: 'Claude' },
  { role: 'Ideato da', name: 'Claude' },
  { role: 'Graphic design', name: 'Claude' },
  { role: 'Music design', name: 'Claude' },
]

/** And who did not. */
export const NO_MERIT: readonly string[] = ['Jo', 'Chri', 'Ale', 'Tina', 'Sara', 'Roma', 'Colo', 'Vale', 'Nico']

/**
 * How long the big title stays before the credits start rolling. With the roll (styles.css,
 * .credits-roll: 0.4 s + 24 s) and the wait for the button, the whole end lasts about 30 seconds.
 */
const TITLE_MS = 4000

type Phase = 'title' | 'roll' | 'end'

/**
 * The end of the whole game, after the arrival of the last world and its summary: a big title, then
 * the credits roll up the screen like at the cinema. It cannot be skipped: the button comes only at
 * the end, and goes back to the start.
 */
export function EndCredits({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [phase, setPhase] = useState<Phase>('title')
  const [ready, setReady] = useState(false)

  // Fireworks for the title and again for the end; while the credits roll the sky stays quiet.
  const fireworks = phase !== 'roll'
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fireworks || prefersReducedMotion()) return
    return startShow(canvas, 5)
  }, [fireworks])

  useEffect(() => {
    sfx.unlock(true)
    try {
      navigator.vibrate?.([120, 80, 120, 80, 400])
    } catch {
      // Vibration is a bonus.
    }
    const timer = window.setTimeout(() => setPhase('roll'), prefersReducedMotion() ? 2500 : TITLE_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase === 'roll' && prefersReducedMotion()) {
      // Without motion the credits stand still on screen for a while.
      const timer = window.setTimeout(() => setPhase('end'), 6000)
      return () => clearTimeout(timer)
    }
    if (phase === 'end') {
      sfx.unlock()
      const timer = window.setTimeout(() => setReady(true), prefersReducedMotion() ? 0 : 1600)
      return () => clearTimeout(timer)
    }
  }, [phase])

  useEffect(() => {
    if (ready) buttonRef.current?.focus({ preventScroll: true })
  }, [ready])

  return (
    <div className={`credits phase-${phase}`} role="dialog" aria-modal="true" aria-label="Il gioco è finito">
      <canvas ref={canvasRef} className="finale-canvas" aria-hidden="true" />
      <div className="credits-title" aria-hidden={phase !== 'title'}>
        <p className="credits-kicker">Hai finito tutti e {WORLDS.length} i mondi</p>
        <h1 className="credits-big">
          <span className="line one">Il gioco</span>
          <span className="line two">è finito!</span>
        </h1>
        <ol className="credits-worlds" aria-hidden="true">
          {WORLDS.map((world, index) => (
            <li key={world.id} style={{ '--i': index } as CSSProperties}>
              {world.icon}
            </li>
          ))}
        </ol>
      </div>
      {phase !== 'title' && (
        <div className="credits-viewport">
          <div
            className="credits-roll"
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) setPhase('end')
            }}
          >
            <p className="credits-logo">
              Park<em>Flung</em>
            </p>
            {CREDITS.map((credit) => (
              <div key={credit.role} className="credits-row">
                <p className="credits-role">{credit.role}</p>
                <p className="credits-name">{credit.name}</p>
              </div>
            ))}
            <div className="credits-row credits-nobody">
              <p className="credits-role">Assolutamente nessun merito</p>
              <ol className="credits-list">
                {NO_MERIT.map((name, index) => (
                  <li key={name}>
                    <span className="credits-number">{index + 1}.</span> {name}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
      {phase === 'end' && (
        <div className="credits-end">
          <p className="credits-fine">Fine</p>
          <p className="credits-thanks">Grazie per aver giocato a ParkFlung</p>
        </div>
      )}
      <button ref={buttonRef} type="button" className={ready ? 'finale-button show' : 'finale-button'} onClick={onDone} tabIndex={ready ? 0 : -1}>
        Torna all'inizio
      </button>
    </div>
  )
}
