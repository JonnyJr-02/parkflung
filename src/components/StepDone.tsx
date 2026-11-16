import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { sfx } from '../game/sound'
import type { SkyId, WorldInfo } from '../game/worlds'
import { Dragon, SKY_FEATURES } from './Art'
import { prefersReducedMotion, startShow } from './Finale'
import { CLOUD_PATH } from './Weather'

/** Rainbow colours, outside in. */
const RAINBOW = ['#e8463c', '#f08c3c', '#f2c230', '#5ab552', '#3b8fd6', '#6a4fc4']

/** The picture in the middle, by the sky the walker just walked into. */
function Centerpiece({ sky, icon }: { sky: SkyId; icon: string }) {
  switch (sky) {
    case 'drizzle':
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
    case 'cloudsun':
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
    case 'sun':
    case 'noon':
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
    case 'sunset':
      // A big sun sinking into the sea, golden reflections, birds.
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
    case 'night':
    case 'night-moon':
    case 'night-starmoon':
      // The moon rises, the stars come out one by one.
      return (
        <svg className="wd-art wd-moonrise" viewBox="0 0 240 140" aria-hidden="true">
          {[[30, 30], [60, 70], [96, 20], [150, 30], [196, 60], [214, 18], [40, 110], [200, 108], [120, 12]].map(([x, y], n) => (
            <circle key={n} className="wd-star" cx={x} cy={y} r={2} style={{ '--i': n } as CSSProperties} />
          ))}
          <g className="wd-moon">
            <circle className="wd-moon-glow" cx="120" cy="80" r="46" />
            <circle className="wd-moon-disc" cx="120" cy="80" r="32" />
            <circle className="wd-moon-crater" cx="110" cy="70" r="6" />
            <circle className="wd-moon-crater" cx="132" cy="92" r="4.5" />
          </g>
        </svg>
      )
    case 'night-stars':
      // The sky fills with stars, a few shooting across.
      return (
        <svg className="wd-art wd-starry" viewBox="0 0 240 140" aria-hidden="true">
          {Array.from({ length: 26 }, (_, n) => (
            <circle key={n} className="wd-star" cx={(n * 53) % 236 + 2} cy={(n * 37) % 132 + 4} r={n % 4 === 0 ? 2.6 : 1.6} style={{ '--i': n % 9 } as CSSProperties} />
          ))}
          <path className="wd-shooting" d="M30 20 L90 50" />
          <path className="wd-shooting two" d="M150 10 L210 40" />
        </svg>
      )
    case 'night-dragons':
      // Dragons fly in breathing fire.
      return (
        <svg className="wd-art wd-dragons" viewBox="0 0 240 140" aria-hidden="true">
          <g className="wd-dragon one">
            <g transform="translate(46 78) scale(1.25)">
              <Dragon fire />
            </g>
          </g>
          <g className="wd-dragon two">
            <g transform="translate(214 122) scale(-0.62 0.62)">
              <Dragon />
            </g>
          </g>
        </svg>
      )
    case 'wonderland':
      // Down the rabbit hole: a spinning spiral, mushrooms and playing cards.
      return (
        <div className="wd-art wd-wonder" aria-hidden="true">
          <span className="wd-spiral" />
          <span className="wd-wonder-emoji">🍄</span>
          {['♥', '♠', '♦', '♣'].map((suit, n) => (
            <span key={suit} className="wd-card" style={{ '--i': n } as CSSProperties}>
              {suit}
            </span>
          ))}
        </div>
      )
    default:
      // The icon of the step, big, spinning in.
      return (
        <div className="wd-art wd-emoji" aria-hidden="true">
          <span className="wd-rays" />
          <span className="wd-emoji-icon">{icon}</span>
        </div>
      )
  }
}

/**
 * Full screen, when the walker gets into a new step of the world (from the second on). It grows
 * with the steps: more confetti, then balloons, then fireworks; the arrival (Finale) is the biggest.
 */
export function StepDone({ world, step, goal, onDone }: { world: WorldInfo; step: number; goal: number; onDone: () => void }) {
  const info = world.steps[step]!
  const features = SKY_FEATURES[info.sky]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [ready, setReady] = useState(false)
  const dark = features.night || info.sky === 'storm' || info.sky === 'drizzle' || info.sky === 'sunset'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion()) return
    return startShow(canvas, step)
  }, [step])

  useEffect(() => {
    sfx.unlock()
    const timer = window.setTimeout(() => setReady(true), prefersReducedMotion() ? 0 : 1500 + step * 300)
    try {
      navigator.vibrate?.([60, 50, 60, 50, 60].slice(0, step * 2))
    } catch {
      // Vibration is a bonus.
    }
    return () => clearTimeout(timer)
  }, [step])

  useEffect(() => {
    if (ready) buttonRef.current?.focus({ preventScroll: true })
  }, [ready])

  return (
    <div
      className={`world-done step-done sky-${info.sky}${dark ? ' dark' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${world.name}: step ${step + 1} di 5. ${info.title}`}
    >
      {step >= 2 && <div className="finale-rays wd-bg-rays" aria-hidden="true" />}
      <canvas ref={canvasRef} className="finale-canvas" aria-hidden="true" />
      <div className="wd-center">
        <Centerpiece sky={info.sky} icon={info.icon} />
        <p className="finale-kicker">
          {world.name} · step {step + 1} di 5 · {Math.round((step * goal) / 5)} punti
        </p>
        <h1 className="wd-title">{info.title}</h1>
        <ol className="finale-stops wd-worlds" aria-hidden="true">
          {world.steps.map((item, index) => (
            <li
              key={item.name}
              className={index < step ? 'reached' : index === step ? 'reached now' : ''}
              style={{ '--i': index } as CSSProperties}
            >
              {item.icon}
            </li>
          ))}
          <li className="house" style={{ '--i': 5 } as CSSProperties}>
            🏁
          </li>
        </ol>
        <p className="finale-note">{info.note}</p>
      </div>
      <button ref={buttonRef} type="button" className={ready ? 'finale-button show' : 'finale-button'} onClick={onDone} tabIndex={ready ? 0 : -1}>
        Continua
      </button>
    </div>
  )
}
