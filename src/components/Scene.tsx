import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MAX_SCORE, STOPS } from '../game/tiers'

/*
 * The trail as a vintage riviera poster. Drawing units: 375 × 560. The poster art sits 60 units
 * down (OFFSET), under a taller sky, so the scene can fill a whole phone screen.
 */
const W = 375
const H = 560
const OFFSET = 60
const TRAIL =
  'M70 392 C 160 402, 320 396, 312 356 C 305 322, 120 334, 92 300 C 70 272, 250 280, 274 250 C 292 226, 170 232, 190 210 C 204 194, 260 196, 296 180'

/** How close the camera gets while the walker moves: width of the visible area in drawing units. */
const CLOSE_WIDTH = 150

function Palm({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} className="p-palm">
      <path className="p-palm-trunk" d="M0 0 C -3 -20, 4 -40, 2 -58" />
      <path d="M2 -58 C -12 -66, -28 -62, -36 -50 C -24 -56, -12 -56, 2 -58 Z" />
      <path d="M2 -58 C 14 -70, 32 -66, 40 -54 C 28 -60, 16 -60, 2 -58 Z" />
      <path d="M2 -58 C -6 -76, -22 -82, -34 -78 C -22 -74, -10 -68, 2 -58 Z" />
      <path d="M2 -58 C 10 -78, 26 -84, 38 -80 C 26 -76, 14 -70, 2 -58 Z" />
      <path d="M2 -58 C 0 -74, 6 -86, 14 -90 C 10 -78, 8 -68, 2 -58 Z" />
    </g>
  )
}

/** The frond: a curved midrib from the hands, arching over the head, with leaflets on both sides. */
const FROND = (() => {
  const P0: [number, number] = [9, -30], C: [number, number] = [26, -78], P2: [number, number] = [-14, -86]
  const at = (t: number): [number, number] => [
    (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t * t * P2[0],
    (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t * t * P2[1],
  ]
  const leaflets: string[] = []
  for (let t = 0.22; t <= 1; t += 0.045) {
    const [x0, y0] = at(t)
    const [x1, y1] = at(Math.min(1, t + 0.01))
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len, L = 15 * (1 - t * 0.55)
    for (const side of [1, -1]) {
      const qx = x0 + nx * side * L * 0.6 + (dx / len) * 3, qy = y0 + ny * side * L * 0.6 + (dy / len) * 3
      const ex = x0 + nx * side * L + (dx / len) * 6, ey = y0 + ny * side * L + (dy / len) * 6
      leaflets.push(`M${x0.toFixed(1)} ${y0.toFixed(1)} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`)
    }
  }
  return { leaflets, rib: `M${P0[0]} ${P0[1] + 10} L${P0[0]} ${P0[1]} Q ${C[0]} ${C[1]} ${P2[0]} ${P2[1]}` }
})()

function Walker() {
  return (
    <>
      <ellipse className="p-shadow" cx={0} cy={1} rx={12} ry={3} />
      <path className="p-leg p-leg-a" d="M-3 -18 L-6 0" />
      <path className="p-leg p-leg-b" d="M3 -18 L6 0" />
      <path className="p-shirt p-ink" d="M-8 -40 Q0 -45 8 -40 L7 -17 H-7 Z" />
      <path className="p-shirt-top p-ink" d="M-8 -40 Q0 -45 8 -40 L7.5 -32 H-7.5 Z" />
      <g className="p-frond">
        {FROND.leaflets.map((d, n) => (
          <path key={n} className="p-leaflet" d={d} />
        ))}
        <path className="p-rib" d={FROND.rib} />
      </g>
      <path className="p-arm-outline" d="M-6 -36 Q 0 -28 8 -26 M6 -37 Q 9 -33 9 -31" />
      <path className="p-arm" d="M-6 -36 Q 0 -28 8 -26 M6 -37 Q 9 -33 9 -31" />
      <circle className="p-head p-ink" cx={0} cy={-50} r={7.5} />
      <path className="p-hair" d="M-7.5 -52 Q -6 -60 0 -59 Q 7 -59 7.5 -52 Q 3 -55 -7.5 -52 Z" />
    </>
  )
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface SceneProps {
  /** Points scored so far: the walker walks there whenever this changes. */
  points: number
  /** Milliseconds to walk 100 points. */
  msPer100?: number
  /** Follow the walker with a close camera while he walks, then pull back to the whole trail. */
  camera?: boolean
  label: string
  className?: string
  onArrive?: () => void
  children?: ReactNode
}

export function Scene({ points, msPer100 = 900, camera = false, label, className, onArrive, children }: SceneProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const walkerRef = useRef<SVGGElement>(null)
  const shownRef = useRef(points)
  const facingRef = useRef(1)
  const posRef = useRef<[number, number]>([70, 392 + OFFSET])
  const zoomTargetRef = useRef(0)
  const arriveRef = useRef(onArrive)
  arriveRef.current = onArrive
  const [stops, setStops] = useState<Array<[number, number]>>([])

  function place(score: number, bob: number) {
    const path = pathRef.current
    const walker = walkerRef.current
    if (!path || !walker) return
    const total = path.getTotalLength()
    const at = total * Math.min(1, Math.max(0, score / MAX_SCORE))
    const p = path.getPointAtLength(at)
    const ahead = path.getPointAtLength(Math.min(total, at + 3))
    if (Math.abs(ahead.x - p.x) > 0.05) facingRef.current = ahead.x < p.x ? -1 : 1
    // Further up the poster is further away: the walker gets a little smaller.
    const size = 1.15 - 0.4 * (score / MAX_SCORE)
    walker.setAttribute('transform', `translate(${p.x.toFixed(2)} ${(p.y - bob).toFixed(2)}) scale(${(facingRef.current * size).toFixed(3)} ${size.toFixed(3)})`)
    posRef.current = [p.x, p.y + OFFSET]
  }

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path) return
    const total = path.getTotalLength()
    setStops(STOPS.map((stop) => {
      const p = path.getPointAtLength((total * stop) / MAX_SCORE)
      return [p.x, p.y]
    }))
    place(shownRef.current, 0)
  }, [])

  // Walking
  useEffect(() => {
    const from = shownRef.current
    if (from === points) return
    shownRef.current = points
    if (prefersReducedMotion()) {
      place(points, 0)
      arriveRef.current?.()
      return
    }
    const duration = Math.max(700, (Math.abs(points - from) / 100) * msPer100)
    const steps = Math.max(2, Math.round(duration / 260))
    const start = performance.now()
    let frame = 0
    walkerRef.current?.classList.add('walking')
    zoomTargetRef.current = 1
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      place(from + (points - from) * eased, 2.2 * Math.abs(Math.sin(Math.PI * steps * t)))
      if (t < 1) frame = requestAnimationFrame(tick)
      else {
        walkerRef.current?.classList.remove('walking')
        zoomTargetRef.current = 0
        arriveRef.current?.()
      }
    }
    // Let the camera close in before the first step.
    const delay = camera ? 500 : 0
    const timer = window.setTimeout(() => (frame = requestAnimationFrame(tick)), delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [points, msPer100, camera])

  // Camera: eases between the whole trail and a close view centred on the walker.
  useEffect(() => {
    if (!camera) return
    let frame = 0
    let zoom = 0
    let cx = posRef.current[0]
    let cy = posRef.current[1]
    const reduce = prefersReducedMotion()
    const step = () => {
      const box = boxRef.current, svg = svgRef.current
      if (box && svg && box.clientWidth > 0) {
        const aspect = box.clientHeight / box.clientWidth
        let wideW = W, wideH = W * aspect
        if (wideH > H) {
          wideH = H
          wideW = H / aspect
        }
        zoom += (zoomTargetRef.current - zoom) * (reduce ? 1 : 0.06)
        const w = wideW + (Math.min(CLOSE_WIDTH, wideW) - wideW) * zoom
        const h = w * aspect
        const [wx, wy] = posRef.current
        cx += (wx - cx) * (reduce ? 1 : 0.18)
        cy += (wy - 40 - cy) * (reduce ? 1 : 0.18)
        const x = Math.min(W - w, Math.max(0, cx - w / 2))
        const y = Math.min(H - h, Math.max(0, cy - h / 2))
        svg.setAttribute('viewBox', `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`)
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [camera])

  return (
    <div ref={boxRef} className={`scene ${className ?? ''}`}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="p-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="p-sky-1" />
            <stop offset="0.6" className="p-sky-2" />
            <stop offset="1" className="p-sky-3" />
          </linearGradient>
          <clipPath id="p-sunclip">
            <rect x="0" y="0" width={W} height={168 + OFFSET} />
          </clipPath>
          <mask id="p-stripes">
            <rect width={W} height={H} fill="#fff" />
            <rect x="0" y={138 + OFFSET} width={W} height="4" fill="#000" />
            <rect x="0" y={148 + OFFSET} width={W} height="6" fill="#000" />
            <rect x="0" y={160 + OFFSET} width={W} height="8" fill="#000" />
          </mask>
        </defs>
        <rect width={W} height={240 + OFFSET} fill="url(#p-sky)" />
        <g className="p-stars">
          {[[24, 40], [80, 22], [140, 60], [196, 30], [300, 48], [350, 20], [40, 120], [330, 110], [110, 150], [260, 90]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} />
          ))}
        </g>
        <g clipPath="url(#p-sunclip)" mask="url(#p-stripes)">
          <circle className="p-sun" cx={232} cy={158 + OFFSET} r={78} />
        </g>
        <g transform={`translate(0 ${OFFSET})`}>
          <path className="p-birds" d="M70 70 q6 -6 12 0 q6 -6 12 0 M104 92 q5 -5 10 0 q5 -5 10 0" />
          <rect className="p-sea" y={166} width={W} height={92} />
          <g className="p-shine">
            <rect x="196" y="174" width="72" height="3" rx="1.5" />
            <rect x="206" y="184" width="52" height="3" rx="1.5" />
            <rect x="216" y="194" width="32" height="3" rx="1.5" />
            <rect x="224" y="204" width="16" height="3" rx="1.5" />
          </g>
          <path className="p-wave" d="M20 190 h34 M60 214 h22 M120 200 h40 M300 222 h40" />
          <path className="p-sail p-ink" d="M118 176 l0 -34 l22 30 z" />
          <path className="p-hull p-ink" d="M104 178 h40 l-6 8 h-28 z" />
          <path className="p-head" d="M196 214 C 230 186, 280 176, 330 172 C 352 170, 368 172, 375 171 L375 500 L196 500 Z" />
          <g className="p-ink">
            <rect className="p-wall" x="278" y="140" width="52" height="38" />
            <path className="p-roof" d="M270 142 L304 112 L338 142 Z" />
            <rect className="p-door" x="298" y="156" width="12" height="22" />
            <rect className="p-window" x="284" y="150" width="9" height="10" />
            <rect className="p-window" x="315" y="150" width="9" height="10" />
            <rect className="p-roof" x="318" y="114" width="7" height="14" />
          </g>
          <path className="p-hill-1" d="M0 238 C 70 214, 150 246, 230 228 C 290 214, 340 228, 375 220 L375 500 L0 500 Z" />
          <path className="p-hill-2" d="M0 300 C 90 276, 200 312, 375 286 L375 500 L0 500 Z" />
          <path className="p-hill-3" d="M0 362 C 100 340, 230 376, 375 352 L375 500 L0 500 Z" />
          <path className="p-hill-4" d="M0 446 C 120 430, 250 458, 375 438 L375 500 L0 500 Z" />
          <path className="p-trail-edge" d={TRAIL} />
          <path ref={pathRef} className="p-trail" d={TRAIL} />
          <path className="p-trail-dash" d={TRAIL} />
          <Palm x={40} y={270} s={0.85} />
          <Palm x={348} y={318} s={1.05} flip />
          <Palm x={222} y={330} s={0.7} />
          <Palm x={352} y={172} s={0.55} />
          <Palm x={214} y={196} s={0.45} flip />
          <Palm x={330} y={478} s={1.25} flip />
          <Palm x={22} y={470} s={1.05} />
          <g className="p-flowers">
            {[[120, 470], [180, 480], [236, 468], [96, 432], [272, 430]].map(([x, y]) => (
              <circle key={`${x}`} cx={x} cy={y} r={3} />
            ))}
          </g>
          <g className="p-ink">
            <path className="p-shaft" d="M66 388 L92 396" />
            <rect className="p-cart" x="14" y="366" width="54" height="22" rx="2" />
            <path className="p-plank" d="M28 366 v22 M42 366 v22 M56 366 v22" />
            <circle className="p-wheel" cx="28" cy="394" r="11" />
            <circle className="p-wheel" cx="56" cy="394" r="11" />
            <path className="p-spoke" d="M17 394 h22 M28 383 v22 M45 394 h22 M56 383 v22" />
          </g>
          {stops.map(([x, y], n) => (
            <g key={n} transform={`translate(${x} ${y - 22})`} className={points >= STOPS[n]! ? 'p-stop reached' : 'p-stop'}>
              <path className="p-stop-pole" d="M0 10 V22" />
              <circle className="p-stop-disc" r={11} />
              <text className="p-stop-text" y={4}>
                {STOPS[n]}
              </text>
            </g>
          ))}
          <g ref={walkerRef} className="p-walker">
            <Walker />
          </g>
        </g>
      </svg>
      {children}
    </div>
  )
}
