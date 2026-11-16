import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { stopsFor } from '../game/tiers'
import type { SkyId, WalkerKind, WorldId } from '../game/worlds'
import { Arrival, Dragons, Landscape, Lights, Moon, SKY_FEATURES, Skulls, Stars, Walker, Wonderland } from './Art'
import { BOLT_PATH, CLOUD_PATH } from './Weather'

export { Walker } from './Art'

/*
 * The trail as a vintage poster, in the colours and the landscape of each world. Drawing units:
 * 375 × 560. The poster art sits 60 units down (OFFSET), under a taller sky, so the scene can fill a
 * whole phone screen.
 */
const W = 375
const H = 560
const OFFSET = 60
const TRAIL =
  'M70 392 C 160 402, 320 396, 312 356 C 305 322, 120 334, 92 300 C 70 272, 250 280, 274 250 C 292 226, 170 232, 190 210 C 204 194, 260 196, 296 180'

/** Sets of clouds in drawing units (x, y of the bottom-left corner, scale), from the storm to the sunset. */
const SKY_CLOUDS: ReadonlyArray<ReadonlyArray<[number, number, number]>> = [
  [[-10, 70, 1.9], [70, 46, 2.3], [180, 80, 2.1], [270, 52, 2.4], [20, 140, 1.8], [130, 128, 2.2], [240, 150, 2], [310, 116, 1.7], [190, 190, 1.9]],
  [[0, 80, 1.7], [120, 58, 2], [250, 88, 1.8], [60, 158, 1.6], [200, 170, 1.9], [300, 146, 1.5]],
  [[20, 96, 1.4], [176, 214, 1.7], [286, 118, 1.3], [100, 56, 1.1]],
  [[36, 86, 0.9], [262, 64, 0.8]],
  [[20, 176, 1.5], [116, 200, 1.1], [300, 160, 1.2]],
]

/** Clouds above the poster for tall screens, in the same order (fewer as the weather clears). */
const HIGH_CLOUDS: ReadonlyArray<ReadonlyArray<[number, number, number]>> = [
  [[10, -40, 2], [190, -90, 2.3], [90, -190, 2.1], [260, -250, 1.9], [0, -330, 1.8]],
  [[30, -60, 1.7], [230, -150, 1.9], [80, -280, 1.6]],
  [[60, -80, 1.3], [250, -220, 1.2]],
  [[200, -120, 0.8]],
  [[40, -60, 1.2], [260, -170, 1]],
]

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

/** Stars in the sky above the poster, shown on tall screens: the same pattern, higher up. */
const HIGH_STARS: ReadonlyArray<[number, number]> = [
  [30, -30], [96, -70], [170, -24], [236, -96], [310, -40], [352, -120], [60, -150], [140, -200], [220, -170],
  [300, -230], [20, -260], [180, -300], [340, -310], [110, -340], [260, -360], [70, -420], [200, -450], [330, -480],
]

/**
 * The room to add around the poster so that its whole width fits the box: on a tall, narrow phone
 * the poster would otherwise be cut on both sides (the start and the arrival). The room goes first
 * under the poster, as more meadow, as far as `clear` pixels (a panel over the bottom of the box),
 * so the poster rises above that panel; whatever is left becomes sky on top.
 */
function roomAround(width: number, height: number, clear: number): { above: number; below: number } {
  if (width <= 0 || height <= 0) return { above: 0, below: 0 }
  const extra = (W * height) / width - H
  if (extra <= 1) return { above: 0, below: 0 }
  const below = Math.min(extra, Math.max(0, (clear * W) / width))
  return { above: Math.ceil(extra - below), below: Math.ceil(below) }
}

/** Milliseconds for one step: the legs (styles.css, .walking) swing at the same pace. */
const STEP_MS = 420

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface SceneProps {
  world: WorldId
  sky: SkyId
  /** How much the scene sways (0 … 3): a step where you are not quite sober. */
  wobble?: number
  /** Points scored so far: the walker walks there whenever this changes. */
  points: number
  /** Points of the arrival: the whole trail. */
  target: number
  /** Milliseconds to walk 100 points. */
  msPer100?: number
  /** Pixels at the bottom of the box covered by a panel: on a tall screen the poster stays above them. */
  clearBottom?: number
  /** The "?" squares: at how many points, and whether each was already met. */
  spots?: ReadonlyArray<{ at: number; used: boolean }>
  walker: WalkerKind
  label: string
  className?: string
  onArrive?: () => void
  children?: ReactNode
}

export function Scene({
  world,
  sky,
  wobble = 0,
  points,
  target,
  msPer100 = 900,
  spots = [],
  clearBottom = 0,
  walker,
  label,
  className,
  onArrive,
  children,
}: SceneProps) {
  const stopPoints = stopsFor(target)
  const rootRef = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState({ above: 0, below: 0 })
  const extra = room.above + room.below
  const clearRef = useRef(clearBottom)
  clearRef.current = clearBottom
  const targetRef = useRef(target)
  targetRef.current = target
  const pathRef = useRef<SVGPathElement>(null)
  const walkerRef = useRef<SVGGElement>(null)
  const shownRef = useRef(points)
  const facingRef = useRef(1)
  const arriveRef = useRef(onArrive)
  arriveRef.current = onArrive
  const [stops, setStops] = useState<Array<[number, number]>>([])
  const [spotPlaces, setSpotPlaces] = useState<Array<[number, number]>>([])
  const shares = spots.map((spot) => Math.min(1, spot.at / target)).join(',')
  const features = SKY_FEATURES[sky]
  // Several scenes can be on screen (the home carousel): each needs its own gradient and clip ids.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  function place(score: number, bob: number) {
    const path = pathRef.current
    const walkerNode = walkerRef.current
    if (!path || !walkerNode) return
    const total = path.getTotalLength()
    const share = Math.min(1, Math.max(0, score / targetRef.current))
    const at = total * share
    const p = path.getPointAtLength(at)
    const ahead = path.getPointAtLength(Math.min(total, at + 3))
    if (Math.abs(ahead.x - p.x) > 0.05) facingRef.current = ahead.x < p.x ? -1 : 1
    // Further up the poster is further away: the walker gets a little smaller.
    const size = 1.15 - 0.4 * share
    walkerNode.setAttribute(
      'transform',
      `translate(${p.x.toFixed(2)} ${(p.y - bob).toFixed(2)}) scale(${(facingRef.current * size).toFixed(3)} ${size.toFixed(3)})`,
    )
    // The part of the trail already walked gets its own colour.
    path.style.strokeDasharray = `${total} ${total + 20}`
    path.style.strokeDashoffset = `${(total - at).toFixed(2)}`
  }

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path) return
    const total = path.getTotalLength()
    setStops(
      [1, 2, 3, 4].map((k) => {
        const p = path.getPointAtLength((total * k) / 5)
        return [p.x, p.y]
      }),
    )
  }, [])

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path) return
    const total = path.getTotalLength()
    setSpotPlaces(
      shares
        .split(',')
        .filter(Boolean)
        .map((share) => {
          const p = path.getPointAtLength(total * Number(share))
          return [p.x, p.y]
        }),
    )
  }, [shares])

  // A box taller than the poster gets more sky on top instead of losing the sides.
  useLayoutEffect(() => {
    const node = rootRef.current
    if (!node) return
    const measure = () => {
      const next = roomAround(node.clientWidth, node.clientHeight, clearRef.current)
      setRoom((now) => (now.above === next.above && now.below === next.below ? now : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [clearBottom])
  const viewBox = `0 ${-room.above} ${W} ${H + extra}`

  // On the first draw, and when the wheel moves the arrival: the walker takes his place on the trail.
  useLayoutEffect(() => {
    place(shownRef.current, 0)
  }, [target])

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
    <div ref={rootRef} className={`scene sky-${sky} land-${world}${features.night ? ' is-night' : ''} ${className ?? ''}`}>
      <div className={wobble ? `scene-wob wobble-${wobble}` : 'scene-wob'}>
        <svg viewBox={viewBox} role="img" aria-label={label} preserveAspectRatio={extra ? 'xMidYMax slice' : 'xMidYMid slice'}>
          <defs>
            <linearGradient id={`p-sky-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={240 + OFFSET}>
              <stop offset="0" className="p-sky-1" />
              <stop offset="0.6" className="p-sky-2" />
              <stop offset="1" className="p-sky-3" />
            </linearGradient>
            {/* The sun above the horizon, cut by three stripes: one clip path, cheap to repaint. */}
            <clipPath id={`p-sunclip-${uid}`}>
              <rect x="0" y="0" width={W} height={138 + OFFSET} />
              <rect x="0" y={142 + OFFSET} width={W} height="6" />
              <rect x="0" y={154 + OFFSET} width={W} height="6" />
            </clipPath>
          </defs>
          <rect y={-room.above} width={W} height={240 + OFFSET + room.above} fill={`url(#p-sky-${uid})`} />
          <g className="p-stars">
            {[[24, 40], [80, 22], [140, 60], [196, 30], [300, 48], [350, 20], [40, 120], [330, 110], [110, 150], [260, 90], ...(room.above ? HIGH_STARS.filter(([, y]) => y > -room.above) : [])].map(
              ([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} />
              ),
            )}
          </g>
          {features.stars && <Stars high={room.above > 0} />}
          {features.moon && <Moon />}
          {sky === 'noon' ? (
            <g className="p-noon-sun">
              <circle className="p-noon-glow" cx={92} cy={124} r={44} />
              <circle className="p-sun" cx={92} cy={124} r={26} />
            </g>
          ) : (
            !features.night && (
              <g className="p-sun-group" clipPath={`url(#p-sunclip-${uid})`}>
                <circle className="p-sun" cx={232} cy={158 + OFFSET} r={78} />
              </g>
            )
          )}
          {features.clouds !== null && (
            <g className="p-clouds" key={sky}>
              {[...SKY_CLOUDS[features.clouds]!, ...(room.above ? HIGH_CLOUDS[features.clouds]!.filter(([, y]) => y > -room.above + 20) : [])].map(([x, y, scale], n) => (
                <g key={n} transform={`translate(${x} ${y + OFFSET - 32 * scale}) scale(${scale})`}>
                  <path className="p-cloud" d={CLOUD_PATH} style={{ animationDelay: `-${n * 3}s` }} />
                </g>
              ))}
            </g>
          )}
          {features.bolt && (
            <g className="p-bolt" transform={`translate(150 ${40 + OFFSET}) scale(2.2)`}>
              <path d={BOLT_PATH} />
            </g>
          )}
          {features.dragons && <Dragons />}
          {features.wonderland && <Wonderland />}
          {features.skulls && <Skulls />}
          <g transform={`translate(0 ${OFFSET})`}>
            <Landscape world={world} trail={TRAIL} wonderland={features.wonderland} />
            {/* More meadow under the poster on a tall screen, where the panel goes. */}
            {room.below > 0 && <rect className="p-hill-4" y={H - OFFSET - 1} width={W} height={room.below + 2} />}
            {/* Night darkens the land; lamps, windows and the arrival glow above it. */}
            <rect className="p-veil" y={-OFFSET - room.above} width={W} height={H + extra} />
            <Lights world={world} />
            <Arrival world={world} />
          </g>
        </svg>
        {/*
          The moving parts on a layer of their own: each frame only the walked trail and the walker are
          drawn again, never the whole poster, so the walk stays smooth on a phone.
        */}
        <svg className="scene-track" viewBox={viewBox} preserveAspectRatio={extra ? 'xMidYMax slice' : 'xMidYMid slice'} aria-hidden="true">
          <g transform={`translate(0 ${OFFSET})`}>
            <path ref={pathRef} className="p-trail-done" d={TRAIL} />
            {stops.map(([x, y], n) => (
              <g key={n} transform={`translate(${x} ${y - 22})`} className={points >= stopPoints[n]! ? 'p-stop reached' : 'p-stop'}>
                <path className="p-stop-pole" d="M0 10 V22" />
                <circle className="p-stop-disc" r={stopPoints[n]! >= 1000 ? 13 : 11} />
                <text className={stopPoints[n]! >= 1000 ? 'p-stop-text small' : 'p-stop-text'} y={4}>
                  {Math.round(stopPoints[n]!)}
                </text>
              </g>
            ))}
            {spotPlaces.map(([x, y], n) => (
              <g key={n} transform={`translate(${x} ${y - 24})`} className={spots[n]?.used ? 'p-surprise used' : 'p-surprise'}>
                <path className="p-stop-pole" d="M0 10 V24" />
                <rect className="p-surprise-box" x={-10} y={-10} width={20} height={20} rx={4} transform="rotate(45)" />
                <text className="p-surprise-text" y={5}>
                  ?
                </text>
              </g>
            ))}
            <g ref={walkerRef} className={`p-walker walker-${walker}`}>
              <Walker kind={walker} />
            </g>
          </g>
        </svg>
      </div>
      {features.rain > 0 && (
        <div className="scene-weather" aria-hidden="true">
          <span className={features.rain === 2 ? 'wx-rain heavy' : 'wx-rain light'} />
          {features.bolt && <span className="wx-flash" />}
        </div>
      )}
      {children}
    </div>
  )
}
