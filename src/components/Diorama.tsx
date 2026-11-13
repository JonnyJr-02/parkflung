import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { STOPS } from '../game/tiers'

/*
 * The island: an 8×8 isometric board. The trail is 21 tiles from the wooden cart to the
 * yellow house, one tile every 25 points, so the four stops (100…400) fall on tiles 4, 8, 12, 16.
 */
const N = 8
const HW = 21
const HH = 10.5
const OX = 187.5
const OY = 78
const DEPTH = 40
const POINTS_PER_TILE = 25

type Cell = readonly [number, number]

const PATH: readonly Cell[] = [
  [7, 7], [7, 6], [7, 5], [7, 4], [7, 3], [7, 2], [7, 1],
  [6, 1], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [5, 6],
  [4, 6], [3, 6], [3, 5], [3, 4], [3, 3], [3, 2], [2, 2],
]
const LAST_TILE = PATH.length - 1
const HOUSE: Cell = [1, 2]
const CART: Cell = [6, 7]
const PALMS: readonly Cell[] = [[0, 5], [1, 7], [6, 0], [4, 0], [2, 6]]
const BUSHES: readonly Cell[] = [[4, 3], [6, 4], [1, 4]]

function iso(i: number, j: number, z = 0): [number, number] {
  return [OX + (i - j) * HW, OY + (i + j) * HH - z]
}
const key = (i: number, j: number) => `${i},${j}`
const pathIndex = new Map(PATH.map(([i, j], index) => [key(i, j), index]))
const isWater = (i: number, j: number) => i + j <= 2 || (i === 3 && j === 0) || (i === 0 && j === 3)
const isSand = (i: number, j: number) => !isWater(i, j) && i + j <= 4 && (i === 0 || j === 0 || i + j === 3)

function pts(points: Array<[number, number]>): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

function tileCenter(index: number): [number, number] {
  const [i, j] = PATH[Math.max(0, Math.min(LAST_TILE, index))]!
  return iso(i + 0.5, j + 0.5, 4)
}

/** Where the walker stands for a (possibly fractional) tile position. */
function positionAt(tile: number): [number, number] {
  const clamped = Math.max(0, Math.min(LAST_TILE, tile))
  const low = Math.floor(clamped)
  const high = Math.min(LAST_TILE, low + 1)
  const [x0, y0] = tileCenter(low)
  const [x1, y1] = tileCenter(high)
  const f = clamped - low
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]
}

const tileOf = (points: number) => Math.min(LAST_TILE, points / POINTS_PER_TILE)

function Box({ i0, j0, i1, j1, h, left, right, top }: { i0: number; j0: number; i1: number; j1: number; h: number; left: string; right: string; top?: string }) {
  const a = iso(i0, j1), b = iso(i1, j1), c = iso(i1, j0), d = iso(i0, j0)
  return (
    <>
      <polygon className={left} points={pts([a, b, [b[0], b[1] - h], [a[0], a[1] - h]])} />
      <polygon className={right} points={pts([b, c, [c[0], c[1] - h], [b[0], b[1] - h]])} />
      {top && <polygon className={top} points={pts([[a[0], a[1] - h], [b[0], b[1] - h], [c[0], c[1] - h], [d[0], d[1] - h]])} />}
    </>
  )
}

function Tile({ i, j }: { i: number; j: number }) {
  if (isWater(i, j)) {
    const z = -6
    const a = iso(i, j, z), b = iso(i + 1, j, z), c = iso(i + 1, j + 1, z), d = iso(i, j + 1, z)
    const cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2
    return (
      <g>
        <polygon className="d-water" points={pts([a, b, c, d])} />
        <path className="d-wave" d={`M${cx - 7} ${cy} q3.5 -3 7 0 t7 0`} />
      </g>
    )
  }
  const onPath = pathIndex.has(key(i, j))
  const z = onPath ? 4 : 0
  const a = iso(i, j, z), b = iso(i + 1, j, z), c = iso(i + 1, j + 1, z), d = iso(i, j + 1, z)
  const surface = onPath ? 'd-path' : isSand(i, j) ? 'd-sand' : (i + j) % 2 ? 'd-grass-a' : 'd-grass-b'
  return (
    <g>
      {onPath && (
        <>
          <polygon className="d-path-l" points={pts([d, c, [c[0], c[1] + z], [d[0], d[1] + z]])} />
          <polygon className="d-path-r" points={pts([c, b, [b[0], b[1] + z], [c[0], c[1] + z]])} />
        </>
      )}
      <polygon className={surface} points={pts([a, b, c, d])} />
      {onPath && <circle className="d-path-dot" cx={(a[0] + c[0]) / 2} cy={(a[1] + c[1]) / 2} r={1.8} />}
    </g>
  )
}

const PALM_LEAVES: Array<[number, number]> = [[-24, -42], [24, -40], [-18, -58], [18, -60], [0, -66], [-27, -51], [27, -49]]

function Palm({ i, j }: { i: number; j: number }) {
  const [x, y] = iso(i + 0.5, j + 0.5)
  const top: [number, number] = [2.2, -47]
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse className="d-shadow" cx={2} cy={2} rx={11} ry={4.5} />
      {[0, 1, 2, 3].map((s) => (
        <rect key={s} className={s % 2 ? 'd-trunk-a' : 'd-trunk-b'} x={-2.7 + s * 0.55} y={-11 - s * 9} width={5.4} height={10} rx={2.3} />
      ))}
      {PALM_LEAVES.map(([dx, dy], n) => (
        <path
          key={n}
          className={n % 2 ? 'd-leaf-a' : 'd-leaf-b'}
          d={`M${top[0]} ${top[1]} Q ${(top[0] + dx) / 2} ${top[1] - 13 + (dy + 47) * 0.2} ${dx} ${dy} Q ${(top[0] + dx) / 2} ${top[1] - 4} ${top[0]} ${top[1]} Z`}
        />
      ))}
      <circle className="d-coco" cx={top[0] - 2.7} cy={top[1] + 2} r={2.7} />
      <circle className="d-coco" cx={top[0] + 2.7} cy={top[1] + 2.7} r={2.7} />
    </g>
  )
}

function Bush({ i, j }: { i: number; j: number }) {
  const [x, y] = iso(i + 0.5, j + 0.5)
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse className="d-shadow" cx={0} cy={2} rx={12} ry={4.5} />
      <circle className="d-bush-a" cx={-5} cy={-5} r={7} />
      <circle className="d-bush-b" cx={4.5} cy={-7} r={8} />
      <circle className="d-bush-c" cx={0} cy={-2} r={6} />
      <circle className="d-flower" cx={3} cy={-9} r={1.8} />
    </g>
  )
}

function House() {
  const [i, j] = HOUSE
  const i0 = i + 0.1, i1 = i + 0.9, j0 = j + 0.15, j1 = j + 0.85, h = 27
  const [cx, cy] = iso(i + 0.5, j + 0.5)
  const ridgeA = iso(i0 - 0.05, (j0 + j1) / 2, h + 18), ridgeB = iso(i1 + 0.05, (j0 + j1) / 2, h + 18)
  const eA1 = iso(i0 - 0.05, j1 + 0.08, h - 2), eB1 = iso(i1 + 0.05, j1 + 0.08, h - 2), eB0 = iso(i1 + 0.05, j0 - 0.08, h - 2)
  const quad = (a: number, b: number, z0: number, z1: number, face: 'left' | 'right') =>
    face === 'left'
      ? pts([iso(a, j1, z0), iso(b, j1, z0), iso(b, j1, z1), iso(a, j1, z1)])
      : pts([iso(i1, a, z0), iso(i1, b, z0), iso(i1, b, z1), iso(i1, a, z1)])
  return (
    <g>
      <ellipse className="d-shadow" cx={cx + 4} cy={cy + 4} rx={24} ry={9} />
      <Box i0={i0} j0={j0} i1={i1} j1={j1} h={h} left="d-wall-l" right="d-wall-r" />
      <polygon className="d-roof-l" points={pts([eA1, eB1, ridgeB, ridgeA])} />
      <polygon className="d-roof-r" points={pts([eB1, eB0, ridgeB])} />
      <polygon className="d-door" points={quad(i0 + 0.34, i0 + 0.52, 0, 15, 'left')} />
      <polygon className="d-window" points={quad(i0 + 0.07, i0 + 0.24, 12, 20, 'left')} />
      <polygon className="d-window" points={quad(i0 + 0.6, i0 + 0.76, 12, 20, 'left')} />
      <polygon className="d-window" points={quad(j0 + 0.22, j0 + 0.42, 12, 20, 'right')} />
    </g>
  )
}

function Cart() {
  const [i, j] = CART
  const [cx, cy] = iso(i + 0.5, j + 0.5)
  return (
    <g>
      <ellipse className="d-shadow" cx={cx + 4} cy={cy + 5} rx={20} ry={6.5} />
      <Box i0={i + 0.15} j0={j + 0.22} i1={i + 0.85} j1={j + 0.82} h={14} left="d-cart-l" right="d-cart-r" top="d-cart-t" />
      {[i + 0.3, i + 0.7].map((a) => {
        const [x, y] = iso(a, j + 0.82, 4)
        return (
          <g key={a}>
            <ellipse className="d-wheel" cx={x} cy={y} rx={6} ry={7} />
            <ellipse className="d-hub" cx={x} cy={y} rx={3.2} ry={3.8} />
          </g>
        )
      })}
    </g>
  )
}

function Flag({ tile, value, reached }: { tile: number; value: number; reached: boolean }) {
  const [x, y] = tileCenter(tile)
  return (
    <g transform={`translate(${x + 9} ${y - 1})`} className={reached ? 'd-stop reached' : 'd-stop'}>
      <rect className="d-pole" x={-1} y={-27} width={2.2} height={27} rx={1} />
      <path className="d-flag" d="M1.2 -27 L20 -22.5 L1.2 -17.5 Z" />
      <text className="d-flag-text" x={0} y={-31}>
        {value}
      </text>
    </g>
  )
}

/** The frond's leaflets, computed once: a curved midrib from the hands with leaflets on both sides. */
const FROND = (() => {
  const P0: [number, number] = [8, -28], C: [number, number] = [26, -76], P2: [number, number] = [-14, -84]
  const at = (t: number): [number, number] => [
    (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t * t * P2[0],
    (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t * t * P2[1],
  ]
  const leaflets: Array<{ d: string; side: number }> = []
  for (let t = 0.2; t <= 1; t += 0.045) {
    const [x0, y0] = at(t)
    const [x1, y1] = at(Math.min(1, t + 0.01))
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len, L = 15 * (1 - t * 0.5)
    for (const side of [1, -1]) {
      const qx = x0 + nx * side * L * 0.6 + (dx / len) * 3, qy = y0 + ny * side * L * 0.6 + (dy / len) * 3
      const ex = x0 + nx * side * L + (dx / len) * 6, ey = y0 + ny * side * L + (dy / len) * 6
      leaflets.push({ d: `M${x0.toFixed(1)} ${y0.toFixed(1)} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, side })
    }
  }
  const rib = `M${P0[0]} ${P0[1] + 12} L${P0[0]} ${P0[1]} Q ${C[0]} ${C[1]} ${P2[0]} ${P2[1]}`
  return { leaflets, rib }
})()

function WalkerFigure() {
  return (
    <>
      <ellipse className="d-shadow-strong" cx={0} cy={1} rx={10} ry={4} />
      <g className="w-legs">
        <rect className="w-leg-a" x={-5} y={-16} width={4} height={16} rx={2} />
        <rect className="w-leg-b" x={1} y={-16} width={4} height={16} rx={2} />
      </g>
      <rect className="w-shirt" x={-8} y={-36} width={16} height={22} rx={7} />
      <rect className="w-stripe" x={-8} y={-24} width={16} height={4} />
      <g className="w-frond">
        {FROND.leaflets.map((leaf, n) => (
          <path key={n} className={leaf.side > 0 ? 'w-leaf-a' : 'w-leaf-b'} d={leaf.d} />
        ))}
        <path className="w-rib" d={FROND.rib} />
      </g>
      <path className="w-arm" d="M-6 -32 Q 0 -24 8 -22 M5 -33 Q 8 -30 8 -27" />
      <circle className="w-head" cx={0} cy={-45} r={9} />
      <path className="w-hair" d="M-9 -47 Q -8 -56 0 -55 Q 9 -55 9 -47 Q 3 -51 -9 -47 Z" />
      <circle className="w-eye" cx={4} cy={-45} r={1.3} />
    </>
  )
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface DioramaProps {
  /** Points scored so far: the walker walks there whenever this changes. */
  points: number
  /** Milliseconds per tile while walking. */
  msPerTile?: number
  /** Show a floating "+N" over the walker when the points go up. */
  showGain?: boolean
  label: string
  className?: string
  onArrive?: () => void
  children?: ReactNode
}

export function Diorama({ points, msPerTile = 230, showGain = false, label, className, onArrive, children }: DioramaProps) {
  const outerRef = useRef<SVGGElement>(null)
  const innerRef = useRef<SVGGElement>(null)
  const shownRef = useRef(points)
  const faceRef = useRef(1)
  const [gain, setGain] = useState<{ value: number; id: number } | null>(null)
  const arriveRef = useRef(onArrive)
  arriveRef.current = onArrive

  function place(tile: number, hop: number, ahead: number) {
    const [x, y] = positionAt(tile)
    const [nx] = positionAt(ahead)
    if (Math.abs(nx - x) > 0.01) faceRef.current = nx < x ? -1 : 1
    outerRef.current?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
    innerRef.current?.setAttribute('transform', `translate(0 ${(-hop).toFixed(2)}) scale(${faceRef.current} 1)`)
  }

  useLayoutEffect(() => {
    const tile = tileOf(shownRef.current)
    place(tile, 0, tile + 0.1)
  }, [])

  useEffect(() => {
    const from = shownRef.current
    if (from === points) return
    const fromTile = tileOf(from)
    const toTile = tileOf(points)
    shownRef.current = points
    if (showGain && points > from) setGain({ value: points - from, id: Date.now() })
    const distance = Math.abs(toTile - fromTile)
    if (prefersReducedMotion() || distance < 0.001) {
      place(toTile, 0, toTile + Math.sign(toTile - fromTile) * 0.1)
      arriveRef.current?.()
      return
    }
    const hops = Math.max(1, Math.round(distance))
    const duration = Math.max(380, distance * msPerTile)
    const direction = Math.sign(toTile - fromTile)
    const start = performance.now()
    let frame = 0
    outerRef.current?.classList.add('walking')
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const tile = fromTile + (toTile - fromTile) * t
      place(tile, 7 * Math.abs(Math.sin(Math.PI * hops * t)), tile + direction * 0.2)
      if (t < 1) frame = requestAnimationFrame(tick)
      else {
        outerRef.current?.classList.remove('walking')
        arriveRef.current?.()
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [points, msPerTile, showGain])

  const scenery = useMemo(() => {
    const cells: Cell[] = []
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) cells.push([i, j])
    cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0])
    const L0 = iso(0, N), B = iso(N, N), R0 = iso(N, 0)
    type Thing = { depth: number; node: ReactNode }
    const things: Thing[] = []
    const depth = ([i, j]: Cell) => i + j + 0.5
    PALMS.forEach((cell) => things.push({ depth: depth(cell), node: <Palm key={`p${key(...cell)}`} i={cell[0]} j={cell[1]} /> }))
    BUSHES.forEach((cell) => things.push({ depth: depth(cell), node: <Bush key={`b${key(...cell)}`} i={cell[0]} j={cell[1]} /> }))
    things.push({ depth: depth(HOUSE), node: <House key="house" /> })
    things.push({ depth: depth(CART), node: <Cart key="cart" /> })
    things.sort((a, b) => a.depth - b.depth)
    return (
      <>
        <g className="d-clouds">
          <ellipse cx={58} cy={40} rx={30} ry={10} />
          <ellipse cx={76} cy={33} rx={19} ry={12} />
          <ellipse cx={318} cy={70} rx={27} ry={9} />
          <ellipse cx={302} cy={64} rx={16} ry={10} />
        </g>
        <g className="d-stars">
          {[[30, 30], [92, 18], [150, 40], [240, 22], [300, 36], [350, 14], [20, 90], [356, 100]].map(([x, y]) => (
            <circle key={`${x}`} cx={x} cy={y} r={1.3} />
          ))}
        </g>
        <ellipse className="d-float-shadow" cx={OX} cy={OY + 2 * N * HH + DEPTH + 26} rx={118} ry={9} />
        <polygon className="d-side-l" points={pts([L0, B, [B[0], B[1] + DEPTH], [L0[0], L0[1] + DEPTH]])} />
        <polygon className="d-side-r" points={pts([B, R0, [R0[0], R0[1] + DEPTH], [B[0], B[1] + DEPTH]])} />
        <polygon className="d-rim-l" points={pts([L0, B, [B[0], B[1] + 7], [L0[0], L0[1] + 7]])} />
        <polygon className="d-rim-r" points={pts([B, R0, [R0[0], R0[1] + 7], [B[0], B[1] + 7]])} />
        {[0.25, 0.55, 0.8].map((t, n) => (
          <circle key={t} className="d-pebble" cx={L0[0] + (B[0] - L0[0]) * t} cy={L0[1] + (B[1] - L0[1]) * t + 16 + n * 6} r={2.6} />
        ))}
        {cells.map(([i, j]) => (
          <Tile key={key(i, j)} i={i} j={j} />
        ))}
        {things.map((thing) => thing.node)}
      </>
    )
  }, [])

  return (
    <div className={`diorama ${className ?? ''}`}>
      <svg viewBox="0 6 375 310" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        {scenery}
        <g ref={outerRef} className="walker">
          <g ref={innerRef}>
            <WalkerFigure />
          </g>
          {gain && (
            <text key={gain.id} className="d-gain" x={0} y={-92}>
              +{gain.value}
            </text>
          )}
        </g>
        {/* Drawn over the walker so his frond never hides a stop number. */}
        {STOPS.map((stop) => (
          <Flag key={stop} tile={stop / POINTS_PER_TILE} value={stop} reached={points >= stop} />
        ))}
      </svg>
      {children}
    </div>
  )
}

