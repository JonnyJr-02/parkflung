import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { worldOf, WORLDS } from '../game/tiers'
import { prefersReducedMotion, startShow } from './Finale'
import { Scene } from './Scene'

/** What the ending says, by the world where the walker stopped: 0 is the storm, 4 the sunset. */
export const GAME_OVER: ReadonlyArray<{ title: string; note: string }> = [
  { title: 'Fermo nel temporale!', note: "L'omino si ripara sotto la pioggia: la casa di Ale è ancora lontana." },
  { title: 'Fermo sotto la pioggerella!', note: 'Il peggio è passato, ma la strada è ancora lunga.' },
  { title: 'Fermo tra nuvole e sole!', note: 'Metà strada fatta: il sole comincia a uscire.' },
  { title: 'Fermo sotto il sole!', note: 'Che bella giornata: la casa di Ale si vede già.' },
  { title: 'A un passo dalla casa di Ale!', note: 'Il tramonto sul mare, la casa lì davanti: per poco!' },
]

/**
 * Full screen, when the questions run out before the house: the walker walks to where he stopped,
 * in the weather of that world, and the party grows with it, from rain in the storm to fireworks at
 * the sunset. Then the summary.
 */
export function GameOver({
  score,
  target,
  questions,
  onDone,
}: {
  score: number
  target: number
  questions: number
  onDone: () => void
}) {
  const world = worldOf(score, target)
  const { title, note } = GAME_OVER[world]!
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [shown, setShown] = useState(0)
  const [walked, setWalked] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion()) return
    // Rain in the storm, then more confetti, balloons and, at the sunset, fireworks.
    return startShow(canvas, world)
  }, [world])

  // The walker sets off from the cart while the score counts up, then the button appears.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(score)
      setWalked(score)
      setReady(true)
      return
    }
    const walk = window.setTimeout(() => setWalked(score), 600)
    const start = performance.now()
    const duration = 1800
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setShown(Math.round(score * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const timer = window.setTimeout(() => setReady(true), 2600 + world * 300)
    try {
      navigator.vibrate?.([70, 60, 70])
    } catch {
      // Vibration is a bonus.
    }
    return () => {
      clearTimeout(walk)
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [score, world])

  useEffect(() => {
    if (ready) buttonRef.current?.focus({ preventScroll: true })
  }, [ready])

  const missing = Math.max(0, target - score)
  return (
    <div
      className={`finale game-over world-${world}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Domande finite. ${title} ${score} punti su ${target}, mancano ${missing} punti.`}
    >
      {world >= 3 && <div className="finale-rays" aria-hidden="true" />}
      <canvas ref={canvasRef} className="finale-canvas" aria-hidden="true" />
      <div className="finale-center">
        <Scene
          className="game-over-scene"
          points={walked}
          target={target}
          world={world}
          msPer100={1400 * (500 / target)}
          label={`L'omino si è fermato a ${score} punti su ${target}`}
        />
        <p className="finale-kicker">
          Domande finite · {questions} {questions === 1 ? 'domanda' : 'domande'}
        </p>
        <p className="finale-score">
          <strong>{shown}</strong>
          <small>/{target}</small>
        </p>
        <ol className="finale-stops" aria-hidden="true">
          {WORLDS.map((item, index) => (
            <li key={item.name} className={index <= world ? 'reached' : ''} style={{ '--i': index } as CSSProperties}>
              {item.icon}
            </li>
          ))}
          <li className="house" style={{ '--i': 5 } as CSSProperties}>
            ⌂
          </li>
        </ol>
        <h1 className="game-over-title">{title}</h1>
        <p className="finale-note">
          {note} Mancavano {missing} punti.
        </p>
      </div>
      <button ref={buttonRef} type="button" className={ready ? 'finale-button show' : 'finale-button'} onClick={onDone} tabIndex={ready ? 0 : -1}>
        Vedi il riepilogo e le risposte
      </button>
    </div>
  )
}
