import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MAX_SCORE, STOPS } from '../game/tiers'

const TRAIL =
  'M 80 394 C 150 402, 300 394, 292 352 C 285 314, 110 332, 86 292 C 66 257, 250 270, 268 234 C 282 206, 150 214, 150 190 C 150 174, 226 180, 262 169'

interface Point {
  x: number
  y: number
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function Palm({ x, y, scale = 1, flip = false }: { x: number; y: number; scale?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <path d="M0 0 C -2 -14, 3 -28, 1 -44" className="palm-trunk" />
      <g className="palm-leaves">
        <path d="M1 -44 C -10 -54, -24 -52, -30 -42 C -20 -46, -10 -46, 1 -44 Z" />
        <path d="M1 -44 C 10 -56, 26 -54, 32 -44 C 22 -48, 11 -47, 1 -44 Z" />
        <path d="M1 -44 C -6 -58, -18 -64, -28 -60 C -18 -58, -8 -53, 1 -44 Z" />
        <path d="M1 -44 C 8 -60, 20 -66, 30 -62 C 20 -59, 10 -54, 1 -44 Z" />
        <path d="M1 -44 C -1 -58, 2 -68, 8 -72 C 6 -62, 5 -54, 1 -44 Z" />
      </g>
    </g>
  )
}

/**
 * The trail from the wooden cart (0 points) to the yellow house by the sea (MAX_SCORE), with the
 * walker carrying a palm branch. When `points` changes the walker walks there.
 */
export function TrailScene({ points, label }: { points: number; label: string }) {
  const pathRef = useRef<SVGPathElement>(null)
  const walkerRef = useRef<SVGGElement>(null)
  const shownRef = useRef(0)
  const [stops, setStops] = useState<Point[]>([])

  function place(score: number) {
    const path = pathRef.current
    const walker = walkerRef.current
    if (!path || !walker) return
    const fraction = Math.min(1, Math.max(0, score / MAX_SCORE))
    const total = path.getTotalLength()
    const at = path.getPointAtLength(total * fraction)
    const ahead = path.getPointAtLength(Math.min(total, total * fraction + 4))
    // Further up the picture is further away: the walker gets smaller.
    const size = 1 - 0.36 * fraction
    const facing = ahead.x < at.x - 0.05 ? -1 : 1
    walker.setAttribute('transform', `translate(${at.x} ${at.y}) scale(${facing * size} ${size})`)
    shownRef.current = score
  }

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path) return
    const total = path.getTotalLength()
    setStops(STOPS.map((stop) => path.getPointAtLength((total * stop) / MAX_SCORE)))
    place(shownRef.current)
  }, [])

  useEffect(() => {
    const from = shownRef.current
    if (from === points) return
    const walker = walkerRef.current
    if (prefersReducedMotion() || !walker) {
      place(points)
      return
    }
    const duration = 700 + Math.abs(points - from) * 5
    const start = performance.now()
    let frame = 0
    walker.classList.add('walking')
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      place(from + (points - from) * easeInOut(t))
      if (t < 1) frame = requestAnimationFrame(tick)
      else walker.classList.remove('walking')
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      walker.classList.remove('walking')
    }
  }, [points])

  return (
    <svg className="trail" viewBox="0 0 360 430" role="img" aria-label={label} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="sky-top" />
          <stop offset="1" className="sky-low" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="sea-far" />
          <stop offset="1" className="sea-near" />
        </linearGradient>
      </defs>

      <rect width="360" height="140" fill="url(#sky)" />
      <circle cx="62" cy="52" r="24" className="sun" />
      <g className="cloud">
        <ellipse cx="150" cy="40" rx="26" ry="9" />
        <ellipse cx="170" cy="34" rx="18" ry="9" />
        <ellipse cx="304" cy="66" rx="22" ry="7" />
      </g>

      <rect y="118" width="360" height="70" fill="url(#sea)" />
      <g className="waves">
        <path d="M20 138 q8 -4 16 0 t16 0" />
        <path d="M120 150 q8 -4 16 0 t16 0" />
        <path d="M60 164 q8 -4 16 0 t16 0" />
        <path d="M190 134 q8 -4 16 0 t16 0" />
      </g>
      <path d="M150 128 l14 -16 l0 16 z M150 130 h18 l-4 5 h-10 z" className="boat" />

      {/* The headland with the house, then the hills coming towards us. */}
      <path d="M176 190 C 200 160, 250 158, 300 150 C 330 146, 350 150, 360 148 L360 430 L0 430 L0 196 C 60 176, 120 200, 176 190 Z" className="hill-far" />
      <path d="M0 262 C 80 236, 170 268, 250 252 C 300 243, 340 256, 360 248 L360 430 L0 430 Z" className="hill-mid" />
      <path d="M0 352 C 90 326, 210 362, 360 334 L360 430 L0 430 Z" className="hill-near" />

      <Palm x={326} y={156} scale={0.62} />
      <Palm x={206} y={176} scale={0.5} flip />
      <Palm x={38} y={262} scale={0.8} />
      <Palm x={334} y={306} scale={0.95} flip />
      <Palm x={196} y={316} scale={0.7} />

      <path d={TRAIL} className="trail-edge" />
      <path ref={pathRef} d={TRAIL} className="trail-path" />
      <path d={TRAIL} className="trail-dashes" />

      {/* The yellow house by the sea. */}
      <g className="house">
        <rect x="238" y="136" width="50" height="33" className="house-wall" />
        <path d="M232 138 L263 114 L294 138 Z" className="house-roof" />
        <rect x="258" y="150" width="10" height="19" className="house-door" />
        <rect x="244" y="144" width="8" height="8" className="house-window" />
        <rect x="274" y="144" width="8" height="8" className="house-window" />
        <rect x="278" y="118" width="5" height="12" className="house-roof" />
      </g>

      {/* The wooden cart where every game starts. */}
      <g className="cart">
        <path d="M66 380 L88 388" className="cart-shaft" />
        <rect x="20" y="364" width="48" height="17" rx="2" className="cart-body" />
        <path d="M32 364 v17 M44 364 v17 M56 364 v17" className="cart-plank" />
        <g className="cart-wheel">
          <circle cx="32" cy="388" r="10" />
          <path d="M22 388 h20 M32 378 v20 M25 381 l14 14 M39 381 l-14 14" />
          <circle cx="58" cy="388" r="10" />
          <path d="M48 388 h20 M58 378 v20 M51 381 l14 14 M65 381 l-14 14" />
        </g>
      </g>

      {stops.map((stop, index) => {
        const reached = points >= STOPS[index]!
        const size = 1 - 0.36 * (STOPS[index]! / MAX_SCORE)
        return (
          <g
            key={index}
            transform={`translate(${stop.x} ${stop.y}) scale(${size})`}
            className={reached ? 'stop reached' : 'stop'}
          >
            <path d="M0 2 V-26" className="stop-pole" />
            <path d="M0 -26 H24 L18 -19 L24 -12 H0 Z" className="stop-flag" />
            <text x="10" y="-15.5" className="stop-text">
              {STOPS[index]}
            </text>
          </g>
        )
      })}

      <g ref={walkerRef} className="walker">
        <ellipse cx="0" cy="1" rx="9" ry="2.6" className="walker-shadow" />
        <g className="walker-body">
          <path d="M-3 -14 L-4 0" className="walker-leg leg-back" />
          <path d="M2 -14 L4 0" className="walker-leg leg-front" />
          <path d="M-6 -30 Q0 -34 6 -30 L5 -13 H-5 Z" className="walker-shirt" />
          <circle cx="0" cy="-37" r="6" className="walker-head" />
          <path d="M-6 -39 Q0 -47 6 -39 Q0 -42 -6 -39 Z" className="walker-hair" />
          <g className="walker-branch">
            <path d="M7 -20 Q12 -40 9 -62" className="branch-stem" />
            <path d="M9 -62 q-9 4 -11 12 q7 -3 11 -12 M9.6 -54 q-9 3 -11 11 q7 -2 11 -11 M10.6 -46 q-8 3 -10 10 q6 -2 10 -10 M9 -62 q9 4 11 12 q-7 -3 -11 -12 M9.6 -54 q9 3 11 11 q-7 -2 -11 -11 M10.6 -46 q8 3 10 10 q-6 -2 -10 -10" className="branch-leaf" />
          </g>
          <path d="M-4 -27 Q4 -20 8 -21 M4 -27 Q7 -23 8 -24" className="walker-arm" />
        </g>
      </g>
    </svg>
  )
}
