/*
 * The drawings of the five worlds: walkers, arrivals, starting points, landscapes and what floats
 * in the night skies. Poster units: 375 wide; the landscape group sits 60 units down (Scene.tsx).
 */
import type { CSSProperties } from 'react'
import type { SkyId, WalkerKind, WorldId } from '../game/worlds'

export function Palm({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
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

function Head({ glasses = false, cheeks = false }: { glasses?: boolean; cheeks?: boolean }) {
  return (
    <>
      <circle className="p-head p-ink" cx={0} cy={-50} r={7.5} />
      <path className="p-hair" d="M-7.5 -52 Q -6 -60 0 -59 Q 7 -59 7.5 -52 Q 3 -55 -7.5 -52 Z" />
      {glasses && <path className="p-glasses" d="M-1 -51.5 h3.5 m1.2 0 h3.5" />}
      {cheeks && <circle className="p-cheek" cx={4} cy={-47.5} r={1.8} />}
    </>
  )
}

function Arm({ d }: { d: string }) {
  return (
    <>
      <path className="p-arm-outline" d={d} />
      <path className="p-arm" d={d} />
    </>
  )
}

function Legs({ skin = false }: { skin?: boolean }) {
  return (
    <>
      <path className={skin ? 'p-leg p-leg-a p-leg-skin' : 'p-leg p-leg-a'} d="M-3 -18 L-6 0" />
      <path className={skin ? 'p-leg p-leg-b p-leg-skin' : 'p-leg p-leg-b'} d="M3 -18 L6 0" />
    </>
  )
}

/** The walker of each world, standing at 0,0 and facing right. */
export function Walker({ kind = 'frond' }: { kind?: WalkerKind }) {
  switch (kind) {
    case 'smoker':
      // A hoodie, and a lit cigarette with a little smoke.
      return (
        <>
          <ellipse className="p-shadow" cx={0} cy={1} rx={12} ry={3} />
          <Legs />
          <path className="p-ink" fill="#56688c" d="M-8 -40 Q0 -45 8 -40 L7 -17 H-7 Z" />
          <path className="p-ink" fill="#465779" d="M-7 -24 H7 L7 -17 H-7 Z" />
          <Arm d="M-7 -36 Q -10 -28 -8 -21 M7 -36 Q 10 -28 8 -21" />
          <Head />
          <path className="p-cigarette" d="M5 -47 L12.5 -45.6" />
          <circle className="p-ember" cx={13.2} cy={-45.5} r={1.5} />
          <g className="p-smoke">
            {[0, 1, 2].map((n) => (
              <circle key={n} cx={13.5} cy={-48} r={2.2} style={{ '--i': n } as CSSProperties} />
            ))}
          </g>
        </>
      )
    case 'cart':
      // Riding a shopping cart with a green bottle held high.
      return (
        <>
          <ellipse className="p-shadow" cx={0} cy={1} rx={16} ry={3} />
          <path className="p-cart-frame" d="M-11 -6 L-10 -2 M9 -6 L9 -2 M-11 -4 H10 M-15 -22 L-20 -27" />
          <circle className="p-cart-wheel" cx={-9} cy={-1.5} r={2.6} />
          <circle className="p-cart-wheel" cx={8} cy={-1.5} r={2.6} />
          <path className="p-ink" fill="#e8664a" d="M-7 -40 Q0 -45 7 -40 L6 -20 H-6 Z" />
          <Arm d="M-6 -36 Q -10 -30 -12 -23" />
          <path className="p-cart-basket" d="M-15 -22 H16 L12 -6 H-11 Z" />
          <path className="p-cart-grid" d="M-8 -22 L-6 -6 M-1 -22 V-6 M6 -22 L5 -6 M12 -22 L10 -6 M-13 -14 H14" />
          <Arm d="M5 -37 Q 11 -42 12 -50" />
          <rect className="p-bottle" x={9.2} y={-61} width={5.6} height={10.5} rx={1.6} />
          <rect className="p-bottle" x={10.9} y={-66} width={2.2} height={5.5} />
          <rect className="p-bottle-label" x={9.8} y={-57} width={4.4} height={3} />
          <Head />
        </>
      )
    case 'swimmer':
      // Swimming trunks, sunglasses and an inflatable ring around the waist.
      return (
        <>
          <ellipse className="p-shadow" cx={0} cy={1} rx={13} ry={3} />
          <Legs skin />
          <path className="p-ink p-skin" d="M-8 -40 Q0 -45 8 -40 L7 -19 H-7 Z" />
          <path className="p-ink" fill="#2f6fd6" d="M-7.5 -21 H7.5 L8 -14 H-8 Z" />
          <Arm d="M-7 -36 Q -12 -31 -12 -25 M7 -36 Q 12 -31 12 -25" />
          <ellipse className="p-ring" cx={0} cy={-23} rx={13.5} ry={5} />
          <ellipse className="p-ring-stripes" cx={0} cy={-23} rx={13.5} ry={5} />
          <Head glasses />
        </>
      )
    case 'beer':
      // A beer mug in hand, and rosy cheeks.
      return (
        <>
          <ellipse className="p-shadow" cx={0} cy={1} rx={12} ry={3} />
          <Legs />
          <path className="p-ink" fill="#6a4c93" d="M-8 -40 Q0 -45 8 -40 L7 -17 H-7 Z" />
          <Arm d="M-7 -36 Q -10 -28 -8 -21 M6 -37 Q 9 -32 10 -28" />
          <rect className="p-mug" x={9} y={-35} width={8} height={10} rx={1.5} />
          <path className="p-mug-handle" d="M17 -32.5 q3.5 1 0 6" />
          <path className="p-foam" d="M8.4 -34.5 q1.5 -3 4 -1.2 q2 -2 4.8 1.2 Z" />
          <Head cheeks />
        </>
      )
    default:
      return (
        <>
          <ellipse className="p-shadow" cx={0} cy={1} rx={12} ry={3} />
          <Legs />
          <path className="p-shirt p-ink" d="M-8 -40 Q0 -45 8 -40 L7 -17 H-7 Z" />
          <path className="p-shirt-top p-ink" d="M-8 -40 Q0 -45 8 -40 L7.5 -32 H-7.5 Z" />
          <g className="p-frond">
            {FROND.leaflets.map((d, n) => (
              <path key={n} className="p-leaflet" d={d} />
            ))}
            <path className="p-rib" d={FROND.rib} />
          </g>
          <Arm d="M-6 -36 Q 0 -28 8 -26 M6 -37 Q 9 -33 9 -31" />
          <Head />
        </>
      )
  }
}

// ---------- Arrivals, at the end of the trail ----------

/** The car with its boot open, in the parking lot. */
function Car() {
  return (
    <g className="arr-car">
      <ellipse className="p-shadow" cx={304} cy={181} rx={44} ry={4} />
      <path className="p-ink arr-boot-lid" d="M330 131 L357 108 L361 113 L335 136 Z" />
      <path className="p-ink arr-car-body" d="M262 152 Q262 147 268 147 L276 147 L287 131 H330 L336 147 H344 Q348 147 348 152 V170 H262 Z" />
      <rect className="arr-boot-inside" x={334} y={135} width={11} height={15} />
      <rect className="arr-crate" x={335} y={141} width={9} height={8} />
      <path className="p-ink arr-car-glass" d="M280 146 L289 134 H306 V146 Z M310 134 H327 L331 146 H310 Z" />
      <rect className="arr-headlight" x={262} y={154} width={5} height={4} rx={1} />
      <rect className="arr-taillight" x={344} y={153} width={4} height={6} rx={1} />
      <circle className="p-ink arr-wheel" cx={282} cy={171} r={8.5} />
      <circle className="arr-hub" cx={282} cy={171} r={3} />
      <circle className="p-ink arr-wheel" cx={330} cy={171} r={8.5} />
      <circle className="arr-hub" cx={330} cy={171} r={3} />
    </g>
  )
}

/** The Tigros supermarket, with carts at the door. */
function Supermarket() {
  return (
    <g className="arr-tigros">
      <rect className="p-ink arr-shop" x={252} y={128} width={96} height={52} />
      <rect className="p-ink arr-sign" x={248} y={113} width={104} height={18} rx={2} />
      <path className="arr-stripes" d="M252 116 l4 12 M258 116 l4 12 M338 116 l4 12 M344 116 l4 12" />
      <text className="arr-sign-text" x={300} y={126.5}>
        TIGROS
      </text>
      <rect className="p-ink arr-glass" x={288} y={148} width={24} height={32} />
      <path className="arr-door-line" d="M300 148 V180" />
      <rect className="p-ink arr-window" x={258} y={140} width={24} height={18} />
      <rect className="p-ink arr-window" x={318} y={140} width={24} height={18} />
      <text className="arr-poster" x={270} y={153}>
        %
      </text>
      <text className="arr-poster" x={330} y={153}>
        €
      </text>
      <path className="arr-carts" d="M256 170 h12 l-2 7 h-9 Z M262 170 h12 l-2 7 h-9 Z" />
    </g>
  )
}

/** The yellow house of Ale with the pool and the white dog. */
function PoolHouse() {
  return (
    <g className="arr-casa">
      <rect className="p-ink arr-house-wall" x={286} y={128} width={56} height={50} />
      <path className="p-ink arr-house-roof" d="M279 130 L314 101 L349 130 Z" />
      <rect className="p-ink arr-house-roof" x={330} y={104} width={7} height={14} />
      <rect className="p-ink arr-house-door" x={308} y={152} width={12} height={26} />
      <rect className="p-ink arr-house-window" x={292} y={138} width={11} height={11} />
      <rect className="p-ink arr-house-window" x={325} y={138} width={11} height={11} />
      <rect className="p-ink arr-pool" x={246} y={160} width={36} height={17} rx={3} />
      <path className="arr-ripple" d="M252 167 q4 -2 8 0 t8 0 M258 172 q4 -2 8 0 t8 0" />
      <path className="arr-ladder" d="M278 158 v8 M281 158 v8 M278 161 h3" />
      <g className="arr-dog">
        <path className="arr-dog-tail" d="M338 170 q5 -6 2 -10" />
        <ellipse className="p-ink arr-dog-fur" cx={331} cy={172} rx={8} ry={5} />
        <path className="arr-dog-legs" d="M326 176 v4 M335 176 v4" />
        <circle className="p-ink arr-dog-fur" cx={323} cy={165} r={5} />
        <ellipse className="arr-dog-ear" cx={325} cy={162} rx={2} ry={3.2} />
        <circle className="arr-dog-eye" cx={321.5} cy={164.5} r={0.9} />
        <circle className="arr-dog-eye" cx={318.6} cy={166.4} r={1.1} />
      </g>
    </g>
  )
}

/** The house of Ale at Varigotti, on the headland (the original poster). */
function RivieraHouse() {
  return (
    <g className="p-ink">
      <rect className="p-wall" x="278" y="140" width="52" height="38" />
      <path className="p-roof" d="M270 142 L304 112 L338 142 Z" />
      <rect className="p-door" x="298" y="156" width="12" height="22" />
      <rect className="p-window" x="284" y="150" width="9" height="10" />
      <rect className="p-window" x="315" y="150" width="9" height="10" />
      <rect className="p-roof" x="318" y="114" width="7" height="14" />
    </g>
  )
}

/** The Decanter: a red and yellow pub with red curtains and lanterns. */
function Pub() {
  return (
    <g className="arr-pub">
      <rect className="p-ink arr-pub-front" x={262} y={118} width={84} height={62} />
      <rect className="p-ink arr-pub-cornice" x={258} y={111} width={92} height={8} />
      <rect className="p-ink arr-pub-sign" x={270} y={122} width={68} height={13} rx={2} />
      <text className="arr-pub-name" x={304} y={131.5}>
        DECANTER
      </text>
      {[268, 318].map((x) => (
        <g key={x}>
          <rect className="p-ink arr-pub-window" x={x} y={140} width={22} height={24} />
          <path className="arr-curtain" d={`M${x} 140 h9 q-3 10 -9 16 Z M${x + 22} 140 h-9 q3 10 9 16 Z`} />
        </g>
      ))}
      <path className="arr-awning" d="M292 140 h24 l-3 6 h-18 Z" />
      <path className="arr-awning-stripes" d="M298 140 l-1 6 M304 140 v6 M310 140 l1 6" />
      <rect className="p-ink arr-pub-door" x={296} y={146} width={16} height={34} />
      <circle className="arr-pub-porthole" cx={304} cy={155} r={3} />
      <circle className="arr-lantern" cx={265} cy={130} r={3} />
      <circle className="arr-lantern" cx={343} cy={130} r={3} />
      <rect className="p-ink arr-barrel" x={346} y={164} width={11} height={16} rx={4} />
    </g>
  )
}

export function Arrival({ world }: { world: WorldId }) {
  switch (world) {
    case 'parcheggio':
      return <Car />
    case 'tigros':
      return <Supermarket />
    case 'casa':
      return <PoolHouse />
    case 'decanter':
      return <Pub />
    default:
      return <RivieraHouse />
  }
}

// ---------- Where the trail starts ----------

export function Start({ world }: { world: WorldId }) {
  switch (world) {
    case 'parcheggio':
      // A parking sign and a ticket machine.
      return (
        <g className="p-ink">
          <path className="st-pole" d="M38 400 V346" />
          <rect className="st-p-sign" x={26} y={326} width={24} height={24} rx={4} />
          <text className="st-p-letter" x={38} y={345}>
            P
          </text>
          <rect className="st-machine" x={52} y={372} width={12} height={22} rx={2} />
          <rect className="st-machine-screen" x={54.5} y={376} width={7} height={5} />
        </g>
      )
    case 'tigros':
      // A row of shopping carts.
      return (
        <g className="st-carts">
          {[0, 9, 18, 27].map((dx) => (
            <g key={dx} transform={`translate(${16 + dx} 380)`}>
              <path className="st-cart" d="M0 0 H16 L13 10 H2 Z" />
              <circle className="st-cart-wheel" cx={4} cy={13} r={2} />
              <circle className="st-cart-wheel" cx={12} cy={13} r={2} />
            </g>
          ))}
        </g>
      )
    case 'casa':
      // A garden gate under an arch of flowers.
      return (
        <g className="p-ink">
          <rect className="st-gate-post" x={22} y={350} width={8} height={48} />
          <rect className="st-gate-post" x={56} y={350} width={8} height={48} />
          <path className="st-gate-arch" d="M26 352 Q 43 330 60 352" />
          <path className="st-gate-bars" d="M30 372 H56 M30 384 H56 M37 366 V396 M43 366 V396 M49 366 V396" />
          <g className="p-flowers" stroke="none">
            <circle cx={30} cy={342} r={3} />
            <circle cx={43} cy={334} r={3} />
            <circle cx={56} cy={342} r={3} />
          </g>
        </g>
      )
    case 'decanter':
      // A bench and a beer barrel under a street lamp.
      return (
        <g className="p-ink">
          <path className="st-bench" d="M14 384 H56 M14 390 H56 M18 390 V400 M52 390 V400" />
          <rect className="arr-barrel" x={58} y={380} width={11} height={16} rx={4} />
        </g>
      )
    default:
      // The wooden cart of the original poster.
      return (
        <g className="p-ink">
          <path className="p-shaft" d="M66 388 L92 396" />
          <rect className="p-cart" x="14" y="366" width="54" height="22" rx="2" />
          <path className="p-plank" d="M28 366 v22 M42 366 v22 M56 366 v22" />
          <circle className="p-wheel" cx="28" cy="394" r="11" />
          <circle className="p-wheel" cx="56" cy="394" r="11" />
          <path className="p-spoke" d="M17 394 h22 M28 383 v22 M45 394 h22 M56 383 v22" />
        </g>
      )
  }
}

// ---------- Landscapes ----------

function Tree({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="ld-trunk" d="M0 0 V-16" />
      <circle className="ld-tree" cx={0} cy={-24} r={11} />
      <circle className="ld-tree" cx={-7} cy={-18} r={7} />
      <circle className="ld-tree" cx={7} cy={-18} r={7} />
    </g>
  )
}

function Cypress({ x, y, s }: { x: number; y: number; s: number }) {
  return <path className="ld-cypress" transform={`translate(${x} ${y}) scale(${s})`} d="M0 0 C -7 -14, -6 -36, 0 -52 C 6 -36, 7 -14, 0 0 Z" />
}

function Lamp({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="ld-lamp-pole" d="M0 0 V-44 Q0 -50 6 -50 H10" />
      <rect className="ld-lamp-head" x={8} y={-52} width={7} height={4} rx={1} />
    </g>
  )
}

/** The light of a street lamp, drawn above the night veil so it glows. */
function LampLight({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="ld-light-cone" d="M9 -48 L-6 0 H28 Z" />
      <circle className="ld-light-bulb" cx={11.5} cy={-48} r={3} />
    </g>
  )
}

function ParkedCar({ x, y, color, flip = false }: { x: number; y: number; color: string; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} className="p-ink">
      <path fill={color} d="M-20 0 V-8 Q-20 -11 -16 -11 L-10 -11 L-5 -18 H10 L14 -11 H18 Q20 -11 20 -8 V0 Z" />
      <path className="ld-car-glass" d="M-8 -12 L-4 -16.5 H3 V-12 Z M5 -16.5 H9 L12 -12 H5 Z" />
      <circle className="ld-car-wheel" cx={-11} cy={1} r={4} />
      <circle className="ld-car-wheel" cx={11} cy={1} r={4} />
    </g>
  )
}

/** Hills and the ground of the trail: the same shapes in every world, coloured by sky and land. */
function Ground() {
  return (
    <>
      <path className="p-hill-1" d="M0 238 C 70 214, 150 246, 230 228 C 290 214, 340 228, 375 220 L375 500 L0 500 Z" />
      <path className="p-hill-2" d="M0 300 C 90 276, 200 312, 375 286 L375 500 L0 500 Z" />
      <path className="p-hill-3" d="M0 362 C 100 340, 230 376, 375 352 L375 500 L0 500 Z" />
      <path className="p-hill-4" d="M0 446 C 120 430, 250 458, 375 438 L375 500 L0 500 Z" />
    </>
  )
}

/** What lies far away, under the sky: the sea at Varigotti, a skyline or hills elsewhere. */
export function Far({ world }: { world: WorldId }) {
  switch (world) {
    case 'varigotti':
      return (
        <>
          <path className="p-birds" d="M70 70 q6 -6 12 0 q6 -6 12 0 M104 92 q5 -5 10 0 q5 -5 10 0" />
          <rect className="p-sea" y={166} width={375} height={92} />
          <g className="p-shine">
            <rect x="196" y="174" width="72" height="3" rx="1.5" />
            <rect x="206" y="184" width="52" height="3" rx="1.5" />
            <rect x="216" y="194" width="32" height="3" rx="1.5" />
            <rect x="224" y="204" width="16" height="3" rx="1.5" />
          </g>
          <path className="p-wave" d="M20 190 h34 M60 214 h22 M120 200 h40 M300 222 h40" />
          <path className="p-sail p-ink" d="M118 176 l0 -34 l22 30 z" />
          <path className="p-hull p-ink" d="M104 178 h40 l-6 8 h-28 z" />
        </>
      )
    case 'casa':
      return (
        <>
          <path className="p-birds" d="M70 70 q6 -6 12 0 q6 -6 12 0" />
          <path className="ld-mountains" d="M0 220 L40 150 L80 196 L130 130 L190 200 L240 160 L300 210 L340 170 L375 196 V260 H0 Z" />
          <path className="ld-mountains-snow" d="M130 130 L118 150 L130 146 L142 150 Z M40 150 L32 164 L40 160 L48 164 Z" />
        </>
      )
    case 'tigros':
      return (
        <>
          <path className="p-birds" d="M70 70 q6 -6 12 0 q6 -6 12 0" />
          <path className="ld-town" d="M0 260 V196 H22 V176 H44 V200 H60 V184 H86 V204 H120 V170 H134 V160 H146 V170 H160 V200 H196 V188 H230 V204 H262 V178 H290 V198 H330 V186 H375 V260 Z" />
        </>
      )
    case 'parcheggio':
      return (
        <>
          <path className="ld-skyline" d="M0 260 V190 H30 V168 H52 V194 H80 V176 H110 V198 H150 V160 H170 V198 H210 V182 H250 V196 H300 V172 H330 V194 H375 V260 Z" />
        </>
      )
    case 'decanter':
      return (
        <>
          <path className="ld-skyline" d="M0 260 V176 L14 164 L28 176 V160 H52 V184 H70 V150 L80 136 L90 150 V188 H118 V168 H140 V190 H170 V158 H186 V140 H194 V158 H206 V186 H240 V172 H262 V196 H300 V170 L316 156 L332 170 V190 H375 V260 Z" />
        </>
      )
  }
}

/** Trees, lamps, cars and flowers along the trail, by world. */
export function Props({ world }: { world: WorldId }) {
  switch (world) {
    case 'varigotti':
      return (
        <>
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
        </>
      )
    case 'casa':
      return (
        <>
          <Cypress x={36} y={276} s={1} />
          <Cypress x={352} y={318} s={1.2} />
          <Cypress x={226} y={326} s={0.8} />
          <Tree x={330} y={478} s={1.4} />
          <Tree x={26} y={470} s={1.2} />
          <path className="ld-hedge" d="M120 300 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 M240 410 q10 -10 20 0 q10 -10 20 0" />
          <g className="p-flowers">
            {[[120, 470], [180, 480], [236, 468], [96, 432], [272, 430], [150, 360], [300, 380]].map(([x, y]) => (
              <circle key={`${x}`} cx={x} cy={y} r={3} />
            ))}
          </g>
        </>
      )
    case 'tigros':
      return (
        <>
          <Tree x={40} y={276} s={0.9} />
          <Tree x={350} y={320} s={1.1} />
          <Tree x={222} y={330} s={0.7} />
          <Tree x={330} y={480} s={1.4} />
          <Lamp x={150} y={300} s={0.9} />
          <rect className="p-ink ld-billboard" x={100} y={236} width={50} height={24} />
          <text className="ld-billboard-text" x={125} y={252}>
            OFFERTE
          </text>
          <path className="ld-billboard-legs" d="M112 260 v14 M138 260 v14" />
          <ParkedCar x={40} y={470} color="#3b8fd6" />
        </>
      )
    case 'parcheggio':
      return (
        <>
          <path className="ld-stripes" d="M150 300 l-6 18 M176 300 l-6 18 M202 300 l-6 18 M228 300 l-6 18 M110 420 l-8 22 M146 420 l-8 22 M182 420 l-8 22 M218 420 l-8 22 M254 420 l-8 22" />
          <ParkedCar x={163} y={318} color="#c0392b" />
          <ParkedCar x={215} y={318} color="#e9b13a" flip />
          <ParkedCar x={128} y={442} color="#3b8fd6" />
          <ParkedCar x={236} y={442} color="#7d8897" flip />
          <Lamp x={30} y={290} />
          <Lamp x={340} y={350} s={1.1} />
          <Lamp x={300} y={480} s={1.3} />
        </>
      )
    case 'decanter':
      return (
        <>
          <g className="ld-cobbles">
            {[[60, 330], [120, 350], [200, 340], [280, 330], [90, 410], [160, 430], [250, 420], [330, 410], [60, 470], [200, 480], [300, 470]].map(([x, y]) => (
              <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={7} ry={3} />
            ))}
          </g>
          <Lamp x={40} y={290} />
          <Lamp x={340} y={350} s={1.1} />
          <Lamp x={30} y={480} s={1.3} />
          <path className="ld-bunting" d="M0 250 Q 60 270 120 250 Q 180 270 240 250" />
          <g className="ld-flags">
            {[20, 50, 80, 110, 140, 170, 200, 230].map((x, n) => (
              <path key={x} d={`M${x} ${256 + (n % 4 === 1 || n % 4 === 2 ? 4 : 0)} l4 9 l4 -9 Z`} className={n % 2 ? 'ld-flag-red' : 'ld-flag-yellow'} />
            ))}
          </g>
        </>
      )
  }
}

/** Lights that glow at night above the veil: street lamps and lit windows. */
export function Lights({ world }: { world: WorldId }) {
  switch (world) {
    case 'parcheggio':
      return (
        <>
          <LampLight x={30} y={290} />
          <LampLight x={340} y={350} s={1.1} />
          <LampLight x={300} y={480} s={1.3} />
          <g className="ld-windows">
            {[[36, 176], [88, 184], [156, 168], [222, 190], [306, 180], [118, 190], [340, 200]].map(([x, y]) => (
              <rect key={`${x}`} x={x} y={y} width={4} height={5} />
            ))}
          </g>
        </>
      )
    case 'decanter':
      return (
        <>
          <LampLight x={40} y={290} />
          <LampLight x={340} y={350} s={1.1} />
          <LampLight x={30} y={480} s={1.3} />
          <g className="ld-windows">
            {[[34, 172], [76, 160], [122, 176], [176, 166], [216, 192], [246, 180], [306, 176], [344, 196], [92, 196]].map(([x, y]) => (
              <rect key={`${x}`} x={x} y={y} width={4} height={6} />
            ))}
          </g>
        </>
      )
    case 'tigros':
      return <LampLight x={150} y={300} s={0.9} />
    default:
      return null
  }
}

// ---------- Night skies ----------

/** Many little stars, twinkling (full poster units). */
export function Stars() {
  const stars = [
    [16, 20], [52, 48], [90, 14], [128, 36], [160, 70], [206, 18], [238, 54], [270, 26], [312, 10], [356, 40],
    [30, 96], [74, 120], [118, 88], [184, 110], [226, 92], [262, 130], [340, 92], [10, 150], [150, 150], [200, 160],
    [300, 150], [360, 136], [96, 170], [250, 176],
  ]
  return (
    <g className="sky-stars">
      {stars.map(([x, y], n) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={n % 3 === 0 ? 1.6 : 1.1} style={{ '--i': n % 5 } as CSSProperties} />
      ))}
    </g>
  )
}

export function Moon() {
  return (
    <g className="sky-moon">
      <circle className="sky-moon-glow" cx={92} cy={122} r={34} />
      <circle className="sky-moon-disc" cx={92} cy={122} r={20} />
      <circle className="sky-moon-crater" cx={86} cy={116} r={4} />
      <circle className="sky-moon-crater" cx={98} cy={128} r={3} />
      <circle className="sky-moon-crater" cx={95} cy={113} r={2} />
    </g>
  )
}

const DRAGON = 'M0 10 C 8 4, 18 4, 26 8 L 34 0 L 32 9 C 40 8, 46 10, 52 6 C 48 14, 40 16, 30 15 C 24 20, 16 22, 8 20 C 4 16, 2 14, 0 10 Z M14 8 L 20 -6 L 26 7 Z'

export function Dragons() {
  return (
    <g className="sky-dragons">
      <g className="sky-dragon one">
        <path d={DRAGON} transform="translate(40 110) scale(1.1)" />
        <path className="sky-fire" d="M40 122 q-12 -2 -18 4 q8 -1 10 3 q-8 1 -10 6 q10 -3 18 -6 Z" />
      </g>
      <g className="sky-dragon two">
        <path d={DRAGON} transform="translate(200 150) scale(-0.8 0.8)" />
      </g>
    </g>
  )
}

/** Down the rabbit hole: giant mushrooms, floating cards, a spiral and a grinning moon. */
export function Wonderland() {
  return (
    <g className="sky-wonder" transform="translate(0 56)">
      <path className="sky-spiral" d="M190 90 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0 a20 20 0 1 1 40 0" />
      <path className="sky-grin" d="M282 52 q20 26 44 0 q-22 14 -44 0 Z" />
      <circle className="sky-grin-eye" cx={292} cy={40} r={3} />
      <circle className="sky-grin-eye" cx={316} cy={40} r={3} />
      {[
        [40, 60, -18, '♥'],
        [110, 30, 14, '♠'],
        [240, 120, -8, '♦'],
        [70, 140, 22, '♣'],
      ].map(([x, y, r, suit], n) => (
        <g key={n} className="sky-card" transform={`translate(${x} ${y}) rotate(${r})`} style={{ '--i': n } as CSSProperties}>
          <rect x={-9} y={-13} width={18} height={26} rx={2} />
          <text y={5}>{suit}</text>
        </g>
      ))}
    </g>
  )
}

/** Giant mushrooms on the hills, in the wonderland step (landscape units). */
export function Mushrooms() {
  return (
    <g className="ld-mushrooms">
      {[
        [56, 300, 1.2],
        [318, 330, 1.4],
        [190, 470, 1],
      ].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
          <path className="ld-mushroom-stem" d="M-5 0 Q-6 -12 -4 -18 H4 Q6 -12 5 0 Z" />
          <path className="ld-mushroom-cap" d="M-18 -16 Q0 -40 18 -16 Z" />
          <circle className="ld-mushroom-dot" cx={-7} cy={-24} r={3} />
          <circle className="ld-mushroom-dot" cx={6} cy={-27} r={2.5} />
          <circle className="ld-mushroom-dot" cx={10} cy={-19} r={2} />
        </g>
      ))}
    </g>
  )
}

export function Skulls() {
  return (
    <g className="sky-skulls" transform="translate(0 50)">
      {[
        [40, 60],
        [130, 30],
        [220, 80],
        [320, 40],
        [90, 130],
        [270, 140],
      ].map(([x, y], n) => (
        <text key={n} x={x} y={y} style={{ '--i': n } as CSSProperties}>
          💀
        </text>
      ))}
    </g>
  )
}

/** What each sky has in it: clouds (a set of SKY_CLOUDS, or none), rain, lightning, night things. */
export const SKY_FEATURES: Record<
  SkyId,
  { clouds: number | null; rain: 0 | 1 | 2; bolt: boolean; night: boolean; moon: boolean; stars: boolean; dragons: boolean; wonderland: boolean; skulls: boolean }
> = {
  storm: { clouds: 0, rain: 2, bolt: true, night: false, moon: false, stars: false, dragons: false, wonderland: false, skulls: false },
  drizzle: { clouds: 1, rain: 1, bolt: false, night: false, moon: false, stars: false, dragons: false, wonderland: false, skulls: false },
  cloudsun: { clouds: 2, rain: 0, bolt: false, night: false, moon: false, stars: false, dragons: false, wonderland: false, skulls: false },
  sun: { clouds: 3, rain: 0, bolt: false, night: false, moon: false, stars: false, dragons: false, wonderland: false, skulls: false },
  sunset: { clouds: 4, rain: 0, bolt: false, night: false, moon: false, stars: false, dragons: false, wonderland: false, skulls: false },
  noon: { clouds: null, rain: 0, bolt: false, night: false, moon: false, stars: false, dragons: false, wonderland: false, skulls: false },
  night: { clouds: null, rain: 0, bolt: false, night: true, moon: true, stars: true, dragons: false, wonderland: false, skulls: false },
  'night-cloudy': { clouds: 1, rain: 0, bolt: false, night: true, moon: false, stars: false, dragons: false, wonderland: false, skulls: false },
  'night-drizzle': { clouds: 1, rain: 1, bolt: false, night: true, moon: false, stars: false, dragons: false, wonderland: false, skulls: false },
  'night-moon': { clouds: 3, rain: 0, bolt: false, night: true, moon: true, stars: false, dragons: false, wonderland: false, skulls: false },
  'night-stars': { clouds: null, rain: 0, bolt: false, night: true, moon: false, stars: true, dragons: false, wonderland: false, skulls: false },
  'night-starmoon': { clouds: null, rain: 0, bolt: false, night: true, moon: true, stars: true, dragons: false, wonderland: false, skulls: false },
  'night-dragons': { clouds: null, rain: 0, bolt: false, night: true, moon: false, stars: true, dragons: true, wonderland: false, skulls: false },
  wonderland: { clouds: null, rain: 0, bolt: false, night: true, moon: false, stars: true, dragons: false, wonderland: true, skulls: false },
  skull: { clouds: null, rain: 0, bolt: false, night: true, moon: false, stars: true, dragons: false, wonderland: false, skulls: true },
}

/** The landscape group of a world, under the sky: far away, ground, trail, props and start. */
export function Landscape({ world, trail, wonderland }: { world: WorldId; trail: string; wonderland: boolean }) {
  return (
    <>
      <Far world={world} />
      <path className="p-head" d="M196 214 C 230 186, 280 176, 330 172 C 352 170, 368 172, 375 171 L375 500 L196 500 Z" />
      <Ground />
      <path className="p-trail-edge" d={trail} />
      <path className="p-trail" d={trail} />
      <path className="p-trail-dash" d={trail} />
      <Props world={world} />
      {wonderland && <Mushrooms />}
      <Start world={world} />
    </>
  )
}
