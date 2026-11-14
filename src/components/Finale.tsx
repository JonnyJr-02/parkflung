import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { WORLDS } from '../game/tiers'
import { Walker } from './Scene'

/**
 * How big the party is at each ending: the more stops, the more confetti and balloons; fireworks
 * from the fourth stop, and the full show (fireworks every few moments) only at the house.
 */
const SHOW = [
  { rain: 80, confetti: 0, balloons: 0, fireworksEveryMs: 0 },
  { rain: 0, confetti: 45, balloons: 0, fireworksEveryMs: 0 },
  { rain: 0, confetti: 90, balloons: 6, fireworksEveryMs: 0 },
  { rain: 0, confetti: 140, balloons: 10, fireworksEveryMs: 0 },
  { rain: 0, confetti: 180, balloons: 12, fireworksEveryMs: 1100 },
  { rain: 0, confetti: 260, balloons: 18, fireworksEveryMs: 360 },
] as const

const COLORS = ['#e8664a', '#e9b13a', '#1f7a80', '#fff8ea', '#23803f', '#7d35c9', '#cf2e28', '#f2c230']

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Rain, confetti, balloons and fireworks on one canvas. Returns a function that stops it. */
export function startShow(canvas: HTMLCanvasElement, level: number): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const show = SHOW[level]!
  let w = 0
  let h = 0
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  const confetto = (anywhere: boolean) => ({
    x: Math.random() * w,
    y: anywhere ? -Math.random() * h : -12,
    vx: (Math.random() - 0.5) * 0.8,
    vy: 1.2 + Math.random() * 2,
    size: 5 + Math.random() * 7,
    rot: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.25,
    sway: Math.random() * Math.PI * 2,
    color: pick(COLORS),
  })
  const balloon = (anywhere: boolean) => ({
    x: 20 + Math.random() * (w - 40),
    y: h + 40 + (anywhere ? Math.random() * h * 0.8 : 0),
    vy: 0.7 + Math.random() * 0.8,
    r: 15 + Math.random() * 12,
    phase: Math.random() * Math.PI * 2,
    color: pick(COLORS.filter((color) => color !== '#fff8ea')),
  })
  const drop = () => ({ x: Math.random() * (w + 80), y: -Math.random() * h, len: 10 + Math.random() * 12, vy: 7 + Math.random() * 4 })

  const confetti = Array.from({ length: show.confetti }, () => confetto(true))
  const balloons = Array.from({ length: show.balloons }, () => balloon(true))
  const rain = Array.from({ length: show.rain }, drop)
  const rockets: Array<{ x: number; y: number; vy: number; top: number; color: string }> = []
  const sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = []
  let sinceRocket = show.fireworksEveryMs ? show.fireworksEveryMs - 400 : 0

  let frame = 0
  let last = performance.now()
  const tick = (now: number) => {
    const dt = Math.min(48, now - last)
    last = now
    const k = dt / 16.67
    ctx.clearRect(0, 0, w, h)

    // Rain for the sad ending: thin slanted lines.
    if (rain.length) {
      ctx.strokeStyle = 'rgb(29 42 68 / 0.35)'
      ctx.lineWidth = 1.6
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (const r of rain) {
        r.y += r.vy * k
        r.x -= r.vy * 0.25 * k
        if (r.y > h) Object.assign(r, drop(), { y: -20 })
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(r.x - r.len * 0.25, r.y + r.len)
      }
      ctx.stroke()
    }

    // Balloons rise and sway, with a string.
    for (const b of balloons) {
      b.y -= b.vy * k
      b.phase += 0.02 * k
      const x = b.x + Math.sin(b.phase) * 10
      if (b.y < -b.r * 3) Object.assign(b, balloon(false))
      ctx.strokeStyle = 'rgb(29 42 68 / 0.6)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(x, b.y + b.r * 1.15)
      ctx.quadraticCurveTo(x - 6, b.y + b.r * 2, x + 2, b.y + b.r * 2.8)
      ctx.stroke()
      ctx.fillStyle = b.color
      ctx.strokeStyle = '#1d2a44'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(x, b.y, b.r * 0.86, b.r, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgb(255 255 255 / 0.45)'
      ctx.beginPath()
      ctx.ellipse(x - b.r * 0.32, b.y - b.r * 0.35, b.r * 0.16, b.r * 0.26, -0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Fireworks: a rocket climbs, then bursts into sparks that fall and fade.
    if (show.fireworksEveryMs) {
      sinceRocket += dt
      if (sinceRocket >= show.fireworksEveryMs) {
        sinceRocket = 0
        rockets.push({ x: w * (0.15 + Math.random() * 0.7), y: h, vy: 9 + Math.random() * 3, top: h * (0.12 + Math.random() * 0.3), color: pick(COLORS) })
      }
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]!
      r.y -= r.vy * k
      ctx.fillStyle = '#fff3b0'
      ctx.fillRect(r.x - 1.5, r.y, 3, 10)
      if (r.y <= r.top) {
        rockets.splice(i, 1)
        const count = level === 5 ? 70 : 46
        const second = level === 5 && Math.random() < 0.5 ? pick(COLORS) : r.color
        for (let s = 0; s < count; s++) {
          const angle = (s / count) * Math.PI * 2 + Math.random() * 0.2
          const speed = 2 + Math.random() * (level === 5 ? 4.2 : 3.2)
          sparks.push({ x: r.x, y: r.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color: s % 2 ? second : r.color })
        }
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!
      s.x += s.vx * k
      s.y += s.vy * k
      s.vx *= 0.985
      s.vy = s.vy * 0.985 + 0.06 * k
      s.life -= 0.012 * k
      if (s.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      ctx.globalAlpha = s.life
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Confetti flutter down and come back from the top.
    for (const c of confetti) {
      c.sway += 0.05 * k
      c.x += (c.vx + Math.sin(c.sway) * 0.6) * k
      c.y += c.vy * k
      c.rot += c.spin * k
      if (c.y > h + 20) Object.assign(c, confetto(false))
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(c.rot)
      ctx.scale(1, Math.cos(c.sway * 1.7))
      ctx.fillStyle = c.color
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2)
      ctx.restore()
    }

    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', resize)
  }
}

/** The house of Ale, by the sea, with the walker waving his frond: only for a perfect game. */
function House() {
  return (
    <svg className="finale-house" viewBox="0 0 220 150" aria-hidden="true">
      <circle className="finale-house-sun" cx="150" cy="78" r="46" />
      <rect className="p-sea" x="0" y="112" width="220" height="38" />
      <path className="p-wave" d="M14 128 h26 M70 140 h22 M150 132 h34" />
      <g className="finale-house-body">
        <rect className="p-wall p-ink" x="96" y="66" width="80" height="50" />
        <path className="p-roof p-ink" d="M86 70 L136 30 L186 70 Z" />
        <rect className="p-roof p-ink" x="158" y="34" width="10" height="20" />
        <rect className="finale-house-window p-ink" x="106" y="78" width="14" height="14" />
        <rect className="finale-house-window p-ink" x="152" y="78" width="14" height="14" />
        <rect className="finale-house-doorway" x="129" y="88" width="16" height="28" />
        <rect className="p-door p-ink finale-house-door" x="129" y="88" width="16" height="28" />
      </g>
      <g className="p-walker finale-house-walker" transform="translate(66 118) scale(1.25)">
        <Walker />
      </g>
      <g className="finale-hearts">
        <path d="M137 84 c-4 -6 -12 -2 -8 4 l8 7 l8 -7 c4 -6 -4 -10 -8 -4 z" style={{ '--i': 0 } as CSSProperties} />
        <path d="M137 84 c-4 -6 -12 -2 -8 4 l8 7 l8 -7 c4 -6 -4 -10 -8 -4 z" style={{ '--i': 1 } as CSSProperties} />
        <path d="M137 84 c-4 -6 -12 -2 -8 4 l8 7 l8 -7 c4 -6 -4 -10 -8 -4 z" style={{ '--i': 2 } as CSSProperties} />
      </g>
    </svg>
  )
}

export const ARRIVAL_TITLE = 'Sei arrivato alla casa di Ale a Varigotti!'

/**
 * Full-screen arrival at the house of Ale, the end of a game: night sky, fireworks, confetti,
 * balloons, the house with lit windows and the walker waving his frond. Then the summary.
 */
export function Finale({ target, questions, onDone }: { target: number; questions: number; onDone: () => void }) {
  const level = 5
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [shown, setShown] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion()) return
    return startShow(canvas, level)
  }, [])

  // The score counts up, then the button appears.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(target)
      setReady(true)
      return
    }
    const start = performance.now()
    const duration = 2100
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const timer = window.setTimeout(() => setReady(true), 3800)
    try {
      navigator.vibrate?.([80, 60, 80, 60, 80, 60, 260])
    } catch {
      // Vibration is a bonus.
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [target])

  useEffect(() => {
    if (ready) buttonRef.current?.focus({ preventScroll: true })
  }, [ready])

  const note = `${target} punti in ${questions} ${questions === 1 ? 'domanda' : 'domande'}`
  const marks = [...WORLDS.map((world) => world.icon), '⌂']
  return (
    <div className={`finale level-${level}`} role="dialog" aria-modal="true" aria-label={`${ARRIVAL_TITLE} ${note}`}>
      <div className="finale-rays" aria-hidden="true" />
      <canvas ref={canvasRef} className="finale-canvas" aria-hidden="true" />
      <div className="finale-center">
        <House />
        <p className="finale-kicker">Traguardo</p>
        <p className="finale-score">
          <strong>{shown}</strong>
          <small>/{target}</small>
        </p>
        <ol className="finale-stops" aria-hidden="true">
          {marks.map((mark, index) => (
            <li key={mark} className={index === marks.length - 1 ? 'reached house' : 'reached'} style={{ '--i': index } as CSSProperties}>
              {mark}
            </li>
          ))}
        </ol>
        <h1 className="finale-title">
          {ARRIVAL_TITLE.split(' ').map((word, index) => (
            <Fragment key={index}>
              <span style={{ '--i': index } as CSSProperties}>{word}</span>{' '}
            </Fragment>
          ))}
        </h1>
        <p className="finale-note">{note}</p>
      </div>
      <button ref={buttonRef} type="button" className={ready ? 'finale-button show' : 'finale-button'} onClick={onDone} tabIndex={ready ? 0 : -1}>
        Vedi il riepilogo
      </button>
    </div>
  )
}
