import { useEffect, useRef, type CSSProperties } from 'react'
import { TIER_INFO } from '../game/tiers'

const LEAVES = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 24) / 10,
  duration: 2.6 + ((i * 29) % 18) / 10,
  turn: i % 2 === 0 ? 1 : -1,
  size: 14 + ((i * 7) % 14),
  gold: i % 3 === 0,
}))

/** Full-screen gold celebration for the rarest tier. It stays until the player taps. */
export function Farflung({ answer, onDone }: { answer: string; onDone: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    buttonRef.current?.focus()
    try {
      navigator.vibrate?.([70, 50, 70, 50, 180])
    } catch {
      // Vibration is a bonus; some browsers refuse it.
    }
  }, [])

  return (
    <div className="farflung" role="dialog" aria-modal="true" aria-label={`${TIER_INFO.t.label}: più 100 punti`}>
      <div className="farflung-rays" aria-hidden="true" />
      <div className="farflung-ring" aria-hidden="true" />
      <div className="farflung-leaves" aria-hidden="true">
        {LEAVES.map((leaf, index) => (
          <span
            key={index}
            className={leaf.gold ? 'leaf gold' : 'leaf'}
            style={
              {
                left: `${leaf.left}%`,
                width: leaf.size,
                height: leaf.size * 2.2,
                animationDelay: `${leaf.delay}s`,
                animationDuration: `${leaf.duration}s`,
                '--turn': leaf.turn,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="farflung-center">
        <p className="farflung-kicker">Risposta rarissima</p>
        <p className="farflung-name">{TIER_INFO.t.label}</p>
        <p className="farflung-points">+{TIER_INFO.t.points}</p>
        {answer && <p className="farflung-answer">{answer}</p>}
      </div>
      <button ref={buttonRef} type="button" className="farflung-button" onClick={onDone}>
        Continua
      </button>
    </div>
  )
}
