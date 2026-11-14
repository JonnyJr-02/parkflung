import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { WORLDS } from '../game/tiers'
import { prefersReducedMotion, startShow } from './Finale'
import { CLOUD_PATH } from './Weather'

/** What each completed world says: 0 is the storm, 3 the sunny world before the sunset. */
export const WORLD_DONE: ReadonlyArray<{ title: string; note: string }> = [
  { title: 'Il temporale è passato!', note: 'Ora pioviggina appena: avanti verso la casa di Ale.' },
  { title: "Spunta l'arcobaleno!", note: 'Smette di piovere e tra le nuvole esce il sole.' },
  { title: 'Via le nuvole!', note: 'Il cielo si apre: adesso splende il sole.' },
  { title: 'Arriva il tramonto!', note: 'Il sole scende sul mare: la casa di Ale è vicina.' },
]

/** Rainbow colours, outside in. */
const RAINBOW = ['#e8463c', '#f08c3c', '#f2c230', '#5ab552', '#3b8fd6', '#6a4fc4']

/** The picture in the middle: each world gets a bigger one. */
function Centerpiece({ world }: { world: number }) {
  if (world === 0) {
    // The storm clouds split and roll away, a small sun comes up between them.
    return (
      <svg className="wd-art wd-storm" viewBox="0 0 240 140" aria-hidden="true">
        <circle className="wd-small-sun" cx="120" cy="78" r="26" />
        <g className="wd-cloud-left">
          <path d={CLOUD_PATH} transform="translate(8 34) scale(2.1)" />
        </g>
        <g className="wd-cloud-right">
          <path d={CLOUD_PATH} transform="translate(98 40) scale(2.1)" />
        </g>
      </svg>
    )
  }
  if (world === 1) {
    // A rainbow draws itself across the sky, with two clouds at its feet.
    return (
      <svg className="wd-art wd-rainbow" viewBox="0 0 240 140" aria-hidden="true">
        {RAINBOW.map((color, n) => (
          <path
            key={color}
            d={`M ${22 + n * 9} 128 A ${98 - n * 9} ${98 - n * 9} 0 0 1 ${218 - n * 9} 128`}
            stroke={color}
            pathLength={1}
            style={{ '--i': n } as CSSProperties}
          />
        ))}
        <path className="wd-foot" d={CLOUD_PATH} transform="translate(-6 104) scale(1.2)" />
        <path className="wd-foot" d={CLOUD_PATH} transform="translate(170 104) scale(1.2)" />
      </svg>
    )
  }
  if (world === 2) {
    // The sun bursts through: rays spin out and the last clouds fly off.
    return (
      <div className="wd-art wd-sunburst" aria-hidden="true">
        <span className="wd-rays" />
        <span className="wd-big-sun" />
        <svg className="wd-fly-left" viewBox="0 0 64 32">
          <path d={CLOUD_PATH} />
        </svg>
        <svg className="wd-fly-right" viewBox="0 0 64 32">
          <path d={CLOUD_PATH} />
        </svg>
      </div>
    )
  }
  // The sunset: a big sun going down on the sea, golden reflections, birds and fireworks.
  return (
    <svg className="wd-art wd-sunset" viewBox="0 0 240 150" aria-hidden="true">
      <defs>
        <clipPath id="wd-sky">
          <rect x="0" y="0" width="240" height="104" />
        </clipPath>
      </defs>
      <circle className="wd-sunset-glow" cx="120" cy="104" r="72" />
      <g clipPath="url(#wd-sky)">
        <circle className="wd-sunset-sun" cx="120" cy="104" r="52" />
      </g>
      <path className="wd-sea" d="M -10 104 H 250 Q 236 146 120 150 Q 4 146 -10 104 Z" />
      {[0, 1, 2, 3, 4].map((n) => (
        <rect key={n} className="wd-glint" x={92 + n * 2 - (n % 2) * 6} y={110 + n * 7} width={56 - n * 9} height="3" rx="1.5" style={{ '--i': n } as CSSProperties} />
      ))}
      <path className="wd-birds" d="M40 40 q6 -6 12 0 q6 -6 12 0 M70 26 q5 -5 10 0 q5 -5 10 0 M176 34 q6 -6 12 0 q6 -6 12 0" />
    </svg>
  )
}

/**
 * Full screen, when the walker leaves a world for the next one. It grows with the worlds: the storm
 * rolling away, then a rainbow, then the sun bursting through, then the sunset with fireworks. The
 * house of Ale (Finale) is the biggest of all.
 */
export function WorldDone({ world, target, onDone }: { world: number; target: number; onDone: () => void }) {
  const level = world + 1
  const next = WORLDS[Math.min(4, world + 1)]!
  const { title, note } = WORLD_DONE[world]!
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion()) return
    return startShow(canvas, level)
  }, [level])

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), prefersReducedMotion() ? 0 : 1500 + world * 400)
    try {
      navigator.vibrate?.([60, 50, 60, 50, 60].slice(0, 1 + world * 2))
    } catch {
      // Vibration is a bonus.
    }
    return () => clearTimeout(timer)
  }, [world])

  useEffect(() => {
    if (ready) buttonRef.current?.focus({ preventScroll: true })
  }, [ready])

  return (
    <div
      className={`world-done done-${world} world-${Math.min(4, world + 1)}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Mondo ${world + 1} completato. ${title}`}
    >
      {world >= 2 && <div className="finale-rays wd-bg-rays" aria-hidden="true" />}
      {world <= 1 && <span className={world === 0 ? 'wx-rain heavy wd-rain-off' : 'wx-rain light wd-rain-off'} aria-hidden="true" />}
      <canvas ref={canvasRef} className="finale-canvas" aria-hidden="true" />
      <div className="wd-center">
        <Centerpiece world={world} />
        <p className="finale-kicker">
          Mondo {world + 1} di 5 completato · {((world + 1) * target) / 5} punti
        </p>
        <h1 className="wd-title">{title}</h1>
        <ol className="finale-stops wd-worlds" aria-hidden="true">
          {WORLDS.map((item, index) => (
            <li
              key={item.name}
              className={index <= world ? 'reached' : index === world + 1 ? 'next' : ''}
              style={{ '--i': index } as CSSProperties}
            >
              {item.icon}
            </li>
          ))}
          <li className="house" style={{ '--i': 5 } as CSSProperties}>
            ⌂
          </li>
        </ol>
        <p className="finale-note">
          {note} Ora: {next.icon} {next.name}.
        </p>
      </div>
      <button ref={buttonRef} type="button" className={ready ? 'finale-button show' : 'finale-button'} onClick={onDone} tabIndex={ready ? 0 : -1}>
        Continua
      </button>
    </div>
  )
}
