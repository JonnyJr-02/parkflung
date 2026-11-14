import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_TARGET, stopsFor } from '../game/tiers'
import { BOLT_PATH, CLOUD_PATH } from './Weather'

/*
 * The trail as a vintage riviera poster. Drawing units: 375 × 560. The poster art sits 60 units
 * down (OFFSET), under a taller sky, so the scene can fill a whole phone screen.
 */
const W = 375
const H = 560
const OFFSET = 60
const TRAIL =
  'M70 392 C 160 402, 320 396, 312 356 C 305 322, 120 334, 92 300 C 70 272, 250 280, 274 250 C 292 226, 170 232, 190 210 C 204 194, 260 196, 296 180'

/** Clouds of each world in drawing units: x, y of the bottom-left corner, scale. */
const SKY_CLOUDS: ReadonlyArray<ReadonlyArray<[number, number, number]>> = [
  [[-10, 70, 1.9], [70, 46, 2.3], [180, 80, 2.1], [270, 52, 2.4], [20, 140, 1.8], [130, 128, 2.2], [240, 150, 2], [310, 116, 1.7], [190, 190, 1.9]],
  [[0, 80, 1.7], [120, 58, 2], [250, 88, 1.8], [60, 158, 1.6], [200, 170, 1.9], [300, 146, 1.5]],
  [[20, 96, 1.4], [176, 214, 1.7], [286, 118, 1.3], [100, 56, 1.1]],
  [[36, 86, 0.9], [262, 64, 0.8]],
  [[20, 176, 1.5], [116, 200, 1.1], [300, 160, 1.2]],
]


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

export function Walker() {
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

/**
 * Walking pace: a short start and stop, and an even speed in between, so the walker strides
 * along instead of rushing through the middle.
 */
function walkEase(t: number): number {
  const a = 0.18
  const v = 1 / (1 - a)
  if (t < a) return (0.5 * v * t * t) / a
  if (t > 1 - a) return 1 - (0.5 * v * (1 - t) * (1 - t)) / a
  return v * (t - a / 2)
}

/** Milliseconds for one step: the legs (styles.css, .walking) swing at the same pace. */
const STEP_MS = 420

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface SceneProps {
  /** Points scored so far: the walker walks there whenever this changes. */
  points: number
  /** Points of the house: the whole trail. */
  target?: number
  /** The weather: 0 storm, 1 drizzle, 2 clouds and sun, 3 sun, 4 sunset. */
  world?: number
  /** Milliseconds to walk 100 points. */
  msPer100?: number
  /** The "?" square: at how many points, and whether it was already met. */
  surprise?: { at: number; used: boolean }
  label: string
  className?: string
  onArrive?: () => void
  children?: ReactNode
}

export function Scene({
  points,
  target = DEFAULT_TARGET,
  world = 4,
  msPer100 = 900,
  surprise,
  label,
  className,
  onArrive,
  children,
}: SceneProps) {
  const stopPoints = stopsFor(target)
  const targetRef = useRef(target)
  targetRef.current = target
  const pathRef = useRef<SVGPathElement>(null)
  const walkerRef = useRef<SVGGElement>(null)
  const shownRef = useRef(points)
  const facingRef = useRef(1)
  const arriveRef = useRef(onArrive)
  arriveRef.current = onArrive
  const [stops, setStops] = useState<Array<[number, number]>>([])
  const [surpriseAt, setSurpriseAt] = useState<[number, number] | null>(null)
  const surpriseShare = surprise ? Math.min(1, surprise.at / target) : null

  function place(score: number, bob: number) {
    const path = pathRef.current
    const walker = walkerRef.current
    if (!path || !walker) return
    const total = path.getTotalLength()
    const share = Math.min(1, Math.max(0, score / targetRef.current))
    const at = total * share
    const p = path.getPointAtLength(at)
    const ahead = path.getPointAtLength(Math.min(total, at + 3))
    if (Math.abs(ahead.x - p.x) > 0.05) facingRef.current = ahead.x < p.x ? -1 : 1
    // Further up the poster is further away: the walker gets a little smaller.
    const size = 1.15 - 0.4 * share
    walker.setAttribute('transform', `translate(${p.x.toFixed(2)} ${(p.y - bob).toFixed(2)}) scale(${(facingRef.current * size).toFixed(3)} ${size.toFixed(3)})`)
    // The part of the trail already walked gets its own colour.
    path.style.strokeDasharray = `${total} ${total + 20}`
    path.style.strokeDashoffset = `${(total - at).toFixed(2)}`
  }

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path) return
    const total = path.getTotalLength()
    setStops([1, 2, 3, 4].map((k) => {
      const p = path.getPointAtLength((total * k) / 5)
      return [p.x, p.y]
    }))
    place(shownRef.current, 0)
  }, [])

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path || surpriseShare === null) {
      setSurpriseAt(null)
      return
    }
    const p = path.getPointAtLength(path.getTotalLength() * surpriseShare)
    setSurpriseAt([p.x, p.y])
  }, [surpriseShare])

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
    // Even a short move gets a few unhurried steps.
    const duration = Math.max(msPer100 * 0.75, (Math.abs(points - from) / 100) * msPer100)
    const steps = Math.max(2, Math.round(duration / STEP_MS))
    const start = performance.now()
    let frame = 0
    walkerRef.current?.classList.add('walking')
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // A soft bob, highest mid-step: sin² has no corners, so the walker does not hop.
      place(from + (points - from) * walkEase(t), 1.8 * Math.sin(Math.PI * steps * t) ** 2)
      if (t < 1) frame = requestAnimationFrame(tick)
      else {
        walkerRef.current?.classList.remove('walking')
        arriveRef.current?.()
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [points, msPer100])

  return (
    <div className={`scene world-${world} ${className ?? ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="p-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="p-sky-1" />
            <stop offset="0.6" className="p-sky-2" />
            <stop offset="1" className="p-sky-3" />
          </linearGradient>
          {/* The sun above the sea, cut by three stripes: one clip path, cheap to repaint as the camera moves. */}
          <clipPath id="p-sunclip">
            <rect x="0" y="0" width={W} height={138 + OFFSET} />
            <rect x="0" y={142 + OFFSET} width={W} height="6" />
            <rect x="0" y={154 + OFFSET} width={W} height="6" />
          </clipPath>
        </defs>
        <rect width={W} height={240 + OFFSET} fill="url(#p-sky)" />
        <g className="p-stars">
          {[[24, 40], [80, 22], [140, 60], [196, 30], [300, 48], [350, 20], [40, 120], [330, 110], [110, 150], [260, 90]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} />
          ))}
        </g>
        <g className="p-sun-group" clipPath="url(#p-sunclip)">
          <circle className="p-sun" cx={232} cy={158 + OFFSET} r={78} />
        </g>
        <g className="p-clouds" key={world}>
          {SKY_CLOUDS[world]!.map(([x, y, scale], n) => (
            <g key={n} transform={`translate(${x} ${y + OFFSET - 32 * scale}) scale(${scale})`}>
              <path className="p-cloud" d={CLOUD_PATH} style={{ animationDelay: `-${n * 3}s` }} />
            </g>
          ))}
        </g>
        {world === 0 && (
          <g className="p-bolt" transform={`translate(150 ${40 + OFFSET}) scale(2.2)`}>
            <path d={BOLT_PATH} />
          </g>
        )}
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
          <path className="p-trail" d={TRAIL} />
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
        </g>
      </svg>
      {/*
        The moving parts on a layer of their own: each frame only the walked trail and the walker are
        drawn again, never the whole poster, so the walk stays smooth on a phone.
      */}
      <svg className="scene-track" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g transform={`translate(0 ${OFFSET})`}>
          <path ref={pathRef} className="p-trail-done" d={TRAIL} />
          {stops.map(([x, y], n) => (
            <g key={n} transform={`translate(${x} ${y - 22})`} className={points >= stopPoints[n]! ? 'p-stop reached' : 'p-stop'}>
              <path className="p-stop-pole" d="M0 10 V22" />
              <circle className="p-stop-disc" r={stopPoints[n]! >= 1000 ? 13 : 11} />
              <text className={stopPoints[n]! >= 1000 ? 'p-stop-text small' : 'p-stop-text'} y={4}>
                {stopPoints[n]}
              </text>
            </g>
          ))}
          {surprise && surpriseAt && (
            <g transform={`translate(${surpriseAt[0]} ${surpriseAt[1] - 24})`} className={surprise.used ? 'p-surprise used' : 'p-surprise'}>
              <path className="p-stop-pole" d="M0 10 V24" />
              <rect className="p-surprise-box" x={-10} y={-10} width={20} height={20} rx={4} transform="rotate(45)" />
              <text className="p-surprise-text" y={5}>
                ?
              </text>
            </g>
          )}
          <g ref={walkerRef} className="p-walker">
            <Walker />
          </g>
        </g>
      </svg>
      {world <= 1 && (
        <div className="scene-weather" aria-hidden="true">
          <span className={world === 0 ? 'wx-rain heavy' : 'wx-rain light'} />
          {world === 0 && <span className="wx-flash" />}
        </div>
      )}
      {children}
    </div>
  )
}
