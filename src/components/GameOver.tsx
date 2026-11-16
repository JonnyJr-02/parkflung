import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { stepOf } from '../game/tiers'
import type { WorldInfo } from '../game/worlds'
import { SKY_FEATURES } from './Art'
import { prefersReducedMotion, startShow } from './Finale'
import { Scene } from './Scene'

/** What the ending says, by how far the walker got: the first step … the last. */
export const GAME_OVER: readonly string[] = ['Ancora lontano', 'Un bel pezzo di strada', 'A metà strada', 'Il traguardo si vede', 'A un passo dal traguardo']

/**
 * Full screen, when the questions run out before the arrival: the walker walks to where he stopped,
 * under the sky of that step, and the party grows with the steps. Then the summary.
 */
export function GameOver({
  world: info,
  score,
  target,
  questions,
  onDone,
}: {
  world: WorldInfo
  score: number
  target: number
  questions: number
  onDone: () => void
}) {
  const world = stepOf(score, target)
  const step = info.steps[world]!
  const title = `${GAME_OVER[world]!}!`
  const dark = SKY_FEATURES[step.sky].night || step.sky === 'storm' || step.sky === 'drizzle' || step.sky === 'sunset'
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
      className={`finale game-over sky-${step.sky}${dark ? ' dark' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Domande finite. ${title} ${score} punti su ${target}, mancano ${missing} punti.`}
    >
      {world >= 3 && <div className="finale-rays" aria-hidden="true" />}
      <canvas ref={canvasRef} className="finale-canvas" aria-hidden="true" />
      <div className="finale-center">
        <Scene
          className="game-over-scene"
          world={info.id}
          sky={step.sky}
          wobble={step.wobble}
          walker={info.walker}
          points={walked}
          target={target}
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
          {info.steps.map((item, index) => (
            <li key={item.name} className={index <= world ? 'reached' : ''} style={{ '--i': index } as CSSProperties}>
              {item.icon}
            </li>
          ))}
          <li className="house" style={{ '--i': 5 } as CSSProperties}>
            🏁
          </li>
        </ol>
        <h1 className="game-over-title">{title}</h1>
        <p className="finale-note">
          Ti sei fermato allo step {step.icon} «{step.name}»: mancavano {missing} punti {info.arrival.to}.
        </p>
      </div>
      <button ref={buttonRef} type="button" className={ready ? 'finale-button show' : 'finale-button'} onClick={onDone} tabIndex={ready ? 0 : -1}>
        Vedi il riepilogo e le risposte
      </button>
    </div>
  )
}
