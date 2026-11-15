import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cardLabel, prizeInfo, prizeNote, PRIZES, spinPrize, type Prize } from '../game/surprise'
import { prefersReducedMotion } from './Finale'

const SLICE = 360 / PRIZES.length
const RADIUS = 104
const SPIN_MS = 5200
const KIND_LABEL = { malus: 'Malus', bonus: 'Bonus', gold: "Bonus d'oro" } as const

function point(angle: number, radius: number): string {
  // Angles clockwise from the top, as the pointer sees them.
  const rad = ((angle - 90) * Math.PI) / 180
  return `${(radius * Math.cos(rad)).toFixed(2)} ${(radius * Math.sin(rad)).toFixed(2)}`
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Haptics are a bonus.
  }
}

/** The wheel itself: five slices with their prize, a rim of lights and a "?" in the middle. */
function WheelArt({ turn, spinning }: { turn: number; spinning: boolean }) {
  return (
    <svg className="wheel-art" viewBox="-120 -120 240 240" aria-hidden="true">
      <g className={spinning ? 'wheel-disc spinning' : 'wheel-disc'} style={{ transform: `rotate(${turn}deg)` }}>
        <circle className="wheel-rim" r={RADIUS + 9} />
        {PRIZES.map((prize, index) => {
          const from = index * SLICE
          const to = from + SLICE
          return (
            <g key={prize.id} className={`wheel-slice ${prize.kind}`}>
              <path d={`M0 0 L${point(from, RADIUS)} A${RADIUS} ${RADIUS} 0 0 1 ${point(to, RADIUS)} Z`} />
              <g transform={`rotate(${from + SLICE / 2})`}>
                <text className="wheel-big" y={-70}>
                  {prize.big}
                </text>
                {prize.small.split('|').map((line, n) => (
                  <text key={line} className="wheel-small" y={-50 + n * 11}>
                    {line}
                  </text>
                ))}
              </g>
            </g>
          )
        })}
        {Array.from({ length: 15 }, (_, n) => (
          <circle key={n} className="wheel-light" cx={0} cy={-(RADIUS + 9)} r={3} transform={`rotate(${n * 24})`} style={{ '--i': n % 2 } as CSSProperties} />
        ))}
      </g>
      <circle className="wheel-hub" r={22} />
      <text className="wheel-hub-text" y={9}>
        ?
      </text>
      <path className="wheel-pointer" d="M0 -100 L-13 -126 H13 Z" />
    </svg>
  )
}

/**
 * The "?" square halfway along the trail, full screen. First two big buttons: go on without
 * a surprise, or take it. Taking it brings up a wheel of fortune that spins on a tap and stops on
 * one of five prizes: two malus (red), two bonus (blue) and the Carta Rivincita (gold).
 */
export function SurpriseSquare({
  target,
  hardcore = true,
  onSkip,
  onPrize,
  onDone,
}: {
  /** Points of the house when the game started: the prizes are told against it. */
  target: number
  /** Hardcore game: the card works after a miss; otherwise after «bada che storia». */
  hardcore?: boolean
  onSkip: () => void
  /** The wheel was spun: the prize is known (and saved) before it stops. */
  onPrize: (prize: Prize) => void
  onDone: () => void
}) {
  const [stage, setStage] = useState<'choose' | 'wheel' | 'spinning' | 'result'>('choose')
  const [prize, setPrize] = useState<Prize | null>(null)
  const [turn, setTurn] = useState(0)
  const doneRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (stage === 'result') doneRef.current?.focus({ preventScroll: true })
  }, [stage])

  function spin() {
    if (stage !== 'wheel') return
    const won = spinPrize()
    const index = PRIZES.findIndex((item) => item.id === won)
    // Six full turns, then the middle of the slice (give or take a little) under the pointer.
    const jitter = (Math.random() - 0.5) * SLICE * 0.6
    setPrize(won)
    onPrize(won)
    buzz(20)
    if (prefersReducedMotion()) {
      setTurn(360 - (index * SLICE + SLICE / 2))
      setStage('result')
      return
    }
    setTurn(6 * 360 + 360 - (index * SLICE + SLICE / 2) + jitter)
    setStage('spinning')
    timers.current.push(
      window.setTimeout(() => {
        setStage('result')
        buzz(prizeInfo(won).kind === 'malus' ? [120] : [60, 50, 60, 50, 140])
      }, SPIN_MS + 250),
    )
  }

  if (stage === 'choose') {
    return (
      <div className="surprise choose" role="dialog" aria-modal="true" aria-labelledby="surprise-title">
        <div className="surprise-head">
          <span className="surprise-mark" aria-hidden="true">
            <span>?</span>
          </span>
          <h1 id="surprise-title" className="surprise-title">
            Casella imprevisti!
          </h1>
          <p className="surprise-sub">Sei a metà strada. Tenti la ruota della fortuna?</p>
        </div>
        <button type="button" className="surprise-choice skip" onClick={onSkip}>
          <strong>Continua senza imprevisto</strong>
          <span>Tutto resta com'è</span>
        </button>
        <button type="button" className="surprise-choice take" onClick={() => setStage('wheel')}>
          <strong>Scegli l'imprevisto</strong>
          <span>2 malus, 2 bonus e una carta d'oro</span>
        </button>
      </div>
    )
  }

  const info = prize ? prizeInfo(prize) : null
  return (
    <div className={`surprise wheel-stage stage-${stage}`} role="dialog" aria-modal="true" aria-label="Ruota della fortuna">
      <div className="finale-rays surprise-rays" aria-hidden="true" />
      <p className="surprise-kicker">Ruota della fortuna</p>
      <button type="button" className="wheel" onClick={spin} disabled={stage !== 'wheel'} aria-label="Gira la ruota">
        <WheelArt turn={turn} spinning={stage === 'spinning'} />
      </button>
      {stage === 'wheel' && (
        <button type="button" className="finale-button show surprise-spin" onClick={spin}>
          Gira la ruota!
        </button>
      )}
      {stage === 'spinning' && <p className="surprise-sub">Gira, gira…</p>}
      {stage === 'result' && info && prize && (
        <div className={`prize-card ${info.kind}`} role="status">
          <p className="prize-kind">{KIND_LABEL[info.kind]}</p>
          {info.kind === 'gold' ? (
            <div className="rivincita" aria-hidden="true">
              <span>🃏</span>
              <small>Carta Rivincita</small>
            </div>
          ) : (
            <p className="prize-big" aria-hidden="true">
              {info.big}
            </p>
          )}
          <h2 className="prize-title">{info.title}</h2>
          <p className="prize-note">{prizeNote(prize, target, hardcore)}</p>
          <button ref={doneRef} type="button" className="btn" onClick={onDone}>
            Continua
          </button>
        </div>
      )}
    </div>
  )
}

/** After the lowest rarity, with the Carta Rivincita in hand: answer the same question once more. */
export function SecondChance({ prompt, hardcore = true, onRetry }: { prompt: string; hardcore?: boolean; onRetry: () => void }) {
  const retryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    retryRef.current?.focus({ preventScroll: true })
    buzz([40, 40, 40])
  }, [])
  return (
    <div className="surprise second" role="dialog" aria-modal="true" aria-labelledby="second-title">
      <div className="rivincita big" aria-hidden="true">
        <span>🃏</span>
        <small>Carta Rivincita</small>
      </div>
      <h1 id="second-title" className="surprise-title">
        {hardcore ? 'Morto di CACCA ADDOSSO…' : 'Bada che storia…'} ma hai la carta!
      </h1>
      <p className="surprise-sub">
        Puoi rispondere di nuovo a «{prompt}» e tentare una risposta più rara. Una volta sola per questa domanda (vale dopo{' '}
        {cardLabel(hardcore)}).
      </p>
      <button ref={retryRef} type="button" className="btn second-retry" onClick={onRetry}>
        Rispondi di nuovo
      </button>
    </div>
  )
}
